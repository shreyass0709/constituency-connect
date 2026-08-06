"use server";

import { revalidatePath } from "next/cache";
import { aiEnabled } from "@/lib/ai/gemini";
import { draftImpactStory } from "@/lib/ai/story";
import { db } from "@/lib/db";
import { ActionError, defineAction } from "@/lib/safe-action";
import { STATUS_LABEL } from "@/constants/status";
import { daysBetween } from "@/lib/utils";
import {
  actionStatSchema,
  draftFromComplaintSchema,
  publishStorySchema,
  representativeSchema,
  storySchema,
} from "./schemas";

/**
 * Content mutations behind the public site. Unlike the complaint surfaces, these pages
 * are cached (ISR), so each action revalidates what it changed — otherwise an editor
 * saves, reloads, and sees the old page for five minutes.
 */

export const upsertActionStat = defineAction({
  name: "content.upsert_action_stat",
  entity: "action_stat",
  schema: actionStatSchema,
  permission: "content.publish",
  handler: async ({ id, ...data }) => {
    const stat = id
      ? await db.actionStat.update({ where: { id }, data, select: { id: true } })
      : await db.actionStat.create({ data, select: { id: true } });

    revalidatePath("/");
    revalidatePath("/action");
    return stat;
  },
});

export const deleteActionStat = defineAction({
  name: "content.delete_action_stat",
  entity: "action_stat",
  schema: publishStorySchema.pick({ id: true }),
  permission: "content.publish",
  handler: async ({ id }) => {
    await db.actionStat.delete({ where: { id } });
    revalidatePath("/");
    revalidatePath("/action");
    return { id };
  },
});

export const updateRepresentativeProfile = defineAction({
  name: "content.update_profile",
  entity: "representative",
  schema: representativeSchema,
  permission: "content.publish",
  handler: async (input) => {
    // Single-tenant: one row, created on first save if the seed never ran.
    const existing = await db.representative.findFirst({ select: { id: true } });
    const profile = existing
      ? await db.representative.update({
          where: { id: existing.id },
          data: input,
          select: { id: true },
        })
      : await db.representative.create({ data: input, select: { id: true } });

    revalidatePath("/");
    revalidatePath("/about");
    revalidatePath("/contact");
    return profile;
  },
});

/** Slugs are public URLs, so they are made once and kept stable across edits. */
function slugify(title: string): string {
  return (
    title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 60) || "story"
  );
}

async function uniqueSlug(title: string): Promise<string> {
  const base = slugify(title);
  for (let attempt = 0; attempt < 20; attempt++) {
    const candidate = attempt === 0 ? base : `${base}-${attempt + 1}`;
    const taken = await db.impactStory.findUnique({
      where: { slug: candidate },
      select: { id: true },
    });
    if (!taken) return candidate;
  }
  return `${base}-${Date.now()}`;
}

/**
 * Draft a story from a complaint that is actually finished. Before/after images come
 * from the complaint's own media — what the citizen photographed, and what the field
 * officer photographed when the work was done.
 */
export const generateStoryDraft = defineAction({
  name: "content.draft_story",
  entity: "impact_story",
  schema: draftFromComplaintSchema,
  permission: "content.publish",
  handler: async ({ complaintId }) => {
    const complaint = await db.complaint.findUnique({
      where: { id: complaintId },
      select: {
        id: true,
        code: true,
        title: true,
        description: true,
        category: true,
        status: true,
        address: true,
        createdAt: true,
        completedAt: true,
        wardId: true,
        ward: { select: { name: true } },
        impactStory: { select: { id: true } },
        media: { select: { url: true, kind: true, stage: true } },
        timeline: {
          where: { isPublic: true },
          select: { note: true, toStatus: true, createdAt: true },
          orderBy: { createdAt: "asc" },
        },
      },
    });
    if (!complaint) throw new ActionError("Complaint not found.");
    if (complaint.status !== "CLOSED" && complaint.status !== "COMPLETED") {
      throw new ActionError("Only a finished complaint makes an impact story.");
    }
    if (complaint.impactStory) throw new ActionError("This complaint already has a story.");

    const before = complaint.media.find(
      (item) => item.kind === "IMAGE" && item.stage === "SUBMISSION",
    );
    const after = complaint.media.find(
      (item) => item.kind === "IMAGE" && item.stage === "RESOLUTION",
    );

    let title = `${complaint.title} — resolved`;
    let body =
      `What was reported: ${complaint.description}\n\n` +
      `What happened:\n` +
      complaint.timeline
        .map(
          (entry) =>
            `- ${entry.toStatus ? STATUS_LABEL[entry.toStatus] : "Update"}${
              entry.note ? `: ${entry.note}` : ""
            }`,
        )
        .join("\n");
    let aiGenerated = false;

    if (aiEnabled()) {
      const drafted = await draftImpactStory({
        category: complaint.category,
        ward: complaint.ward?.name,
        area: complaint.address,
        description: complaint.description,
        daysToResolve: complaint.completedAt
          ? daysBetween(complaint.createdAt, complaint.completedAt)
          : null,
        timeline: complaint.timeline.map(
          (entry) =>
            `${entry.toStatus ? STATUS_LABEL[entry.toStatus] : "Update"}${
              entry.note ? `: ${entry.note}` : ""
            }`,
        ),
      });
      if (drafted) {
        title = drafted.title;
        body = drafted.body;
        aiGenerated = true;
      }
    }

    // Always a draft: `publishedAt` stays null until a human presses publish.
    const story = await db.impactStory.create({
      data: {
        slug: await uniqueSlug(title),
        title,
        body,
        complaintId: complaint.id,
        wardId: complaint.wardId,
        beforeImage: before?.url ?? null,
        afterImage: after?.url ?? null,
        aiGenerated,
      },
      select: { id: true },
    });

    return { id: story.id, aiGenerated };
  },
});

export const upsertImpactStory = defineAction({
  name: "content.upsert_story",
  entity: "impact_story",
  schema: storySchema,
  permission: "content.publish",
  handler: async ({ id, ...data }) => {
    const story = id
      ? await db.impactStory.update({ where: { id }, data, select: { id: true, slug: true } })
      : await db.impactStory.create({
          data: { ...data, slug: await uniqueSlug(data.title) },
          select: { id: true, slug: true },
        });

    revalidatePath("/stories");
    revalidatePath(`/stories/${story.slug}`);
    return story;
  },
});

/** The human gate. Nothing reaches the public site without passing through here. */
export const publishImpactStory = defineAction({
  name: "content.publish_story",
  entity: "impact_story",
  schema: publishStorySchema,
  permission: "content.publish",
  handler: async ({ id, publish }) => {
    const story = await db.impactStory.update({
      where: { id },
      data: { publishedAt: publish ? new Date() : null },
      select: { id: true, slug: true, publishedAt: true },
    });

    revalidatePath("/");
    revalidatePath("/stories");
    revalidatePath(`/stories/${story.slug}`);
    return story;
  },
});
