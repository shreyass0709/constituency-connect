import type { Prisma } from "@/generated/prisma/client";
import { confirmDuplicate } from "@/lib/ai/duplicates";
import { aiEnabled } from "@/lib/ai/gemini";
import { classifyComplaint } from "@/lib/ai/intake";
import { db } from "@/lib/db";
import type { AiMeta } from "./ai-meta";
import { distanceMeters } from "./geo";
import { addTimelineEntry } from "./transition";

/**
 * What happens to a complaint in the seconds after it is submitted, in `after()` so the
 * citizen never waits for it.
 *
 * If any of it fails — no key, timeout, nonsense answer — the complaint is stamped
 * `status: "failed"` and shows up in the Unclassified queue for a human. That is the
 * whole safety story: the office loses a convenience, never a complaint.
 */

const DUPLICATE_RADIUS_M = 150;
const DUPLICATE_WINDOW_DAYS = 30;
/** Below this we keep the verdict to ourselves rather than nagging staff about it. */
const DUPLICATE_MIN_CONFIDENCE = 0.6;

export async function runIntake(complaintId: string): Promise<void> {
  try {
    const complaint = await db.complaint.findUnique({
      where: { id: complaintId },
      select: {
        id: true,
        title: true,
        description: true,
        category: true,
        latitude: true,
        longitude: true,
        address: true,
        createdAt: true,
        ward: { select: { name: true } },
      },
    });
    if (!complaint) return;

    if (!aiEnabled()) return markUnclassified(complaintId, "AI is switched off");

    const departments = await db.department.findMany({
      select: { id: true, slug: true, name: true, categories: true },
    });

    const [classified, duplicate] = await Promise.all([
      classifyComplaint({
        title: complaint.title,
        description: complaint.description,
        citizenCategory: complaint.category,
        ward: complaint.ward?.name,
        address: complaint.address,
        departments,
      }),
      findDuplicate(complaint),
    ]);

    if (!classified) return markUnclassified(complaintId, "Automatic tagging did not answer");

    const department = departments.find((d) => d.slug === classified.departmentSlug) ?? null;
    const meta: AiMeta = {
      status: "ok",
      at: new Date().toISOString(),
      suggestedCategory: classified.category,
      suggestedPriority: classified.priority,
      suggestedDepartmentId: department?.id ?? null,
      suggestedDepartmentName: department?.name ?? null,
      confidence: classified.confidence,
      summary: classified.summary,
      duplicate,
    };

    // Applied outright: things nothing else sets, and that no human was going to type in.
    // Category and department stay suggestions — routing is the office's call.
    await db.complaint.update({
      where: { id: complaintId },
      data: {
        priority: classified.priority,
        sentiment: classified.sentiment,
        language: classified.language,
        aiMeta: meta as Prisma.InputJsonValue,
      },
    });

    await addTimelineEntry({
      complaintId,
      type: "AI_ACTION",
      isPublic: false,
      note:
        `Read as ${classified.category} · ${classified.priority} priority` +
        `${department ? ` · ${department.name}` : ""} (${Math.round(classified.confidence * 100)}% sure)` +
        `${duplicate ? ` · possible duplicate of ${duplicate.code}` : ""}`,
      meta: { ...meta } as Prisma.InputJsonValue,
    });
  } catch (error) {
    console.error("[ai] intake failed", complaintId, error);
    await markUnclassified(complaintId, "Automatic tagging errored");
  }
}

async function markUnclassified(complaintId: string, reason: string) {
  const meta: AiMeta = { status: "failed", at: new Date().toISOString(), summary: reason };
  await db.complaint
    .update({ where: { id: complaintId }, data: { aiMeta: meta as Prisma.InputJsonValue } })
    .catch((error) => console.error("[ai] could not mark unclassified", complaintId, error));
}

/**
 * SQL narrows by category, a bounding box and the last 30 days; Gemini only judges the
 * few that survive. Without coordinates there is nothing to narrow by, so we skip.
 */
async function findDuplicate(complaint: {
  id: string;
  title: string;
  description: string;
  category: string;
  latitude: number | null;
  longitude: number | null;
}): Promise<AiMeta["duplicate"]> {
  if (typeof complaint.latitude !== "number" || typeof complaint.longitude !== "number") {
    return null;
  }

  // ~0.002° is comfortably wider than 150 m anywhere in India; the exact circle is cut
  // in JS below, and the (latitude, longitude) index does the heavy lifting.
  const box = 0.002;
  const since = new Date(Date.now() - DUPLICATE_WINDOW_DAYS * 24 * 60 * 60 * 1000);

  const nearby = await db.complaint.findMany({
    where: {
      id: { not: complaint.id },
      category: complaint.category as never,
      createdAt: { gte: since },
      status: { notIn: ["DRAFT", "REJECTED"] },
      latitude: { gte: complaint.latitude - box, lte: complaint.latitude + box },
      longitude: { gte: complaint.longitude - box, lte: complaint.longitude + box },
    },
    select: {
      id: true,
      code: true,
      title: true,
      description: true,
      latitude: true,
      longitude: true,
    },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  const candidates = nearby
    .map((item) => ({
      ...item,
      distanceMeters: distanceMeters(
        { latitude: complaint.latitude!, longitude: complaint.longitude! },
        { latitude: item.latitude!, longitude: item.longitude! },
      ),
    }))
    .filter((item) => item.distanceMeters <= DUPLICATE_RADIUS_M)
    .sort((a, b) => a.distanceMeters - b.distanceMeters)
    .slice(0, 5);

  const verdict = await confirmDuplicate({
    candidate: { title: complaint.title, description: complaint.description },
    existing: candidates.map(({ code, title, description, distanceMeters: metres }) => ({
      code,
      title,
      description,
      distanceMeters: metres,
    })),
  });

  if (!verdict?.duplicateOfCode || verdict.confidence < DUPLICATE_MIN_CONFIDENCE) return null;
  const match = candidates.find((item) => item.code === verdict.duplicateOfCode);
  if (!match) return null;

  return {
    id: match.id,
    code: match.code,
    confidence: verdict.confidence,
    reason: verdict.reason,
  };
}
