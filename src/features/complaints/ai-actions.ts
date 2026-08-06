"use server";

import type { Prisma } from "@/generated/prisma/client";
import { z } from "zod";
import {
  suggestOfficerResponse,
  transcribeAudio,
  translateComplaintText,
} from "@/lib/ai/assist";
import { aiEnabled } from "@/lib/ai/gemini";
import { db } from "@/lib/db";
import { ActionError, defineAction } from "@/lib/safe-action";
import { STATUS_LABEL } from "@/constants/status";
import { canViewComplaint } from "./lib/access";
import { aiMetaOf, type AiMeta } from "./lib/ai-meta";

/**
 * The on-demand AI helpers. Every one of them fails to a plain message the user can act
 * on — "type it yourself" is always available, because none of these is on the path
 * between a citizen and a filed complaint.
 */

const OFF = "The assistant is unavailable right now.";

/** Voice note → editable text in the raise wizard. */
export const transcribeVoiceNote = defineAction({
  name: "complaint.transcribe",
  entity: "media",
  schema: z.object({ mediaId: z.string().min(1) }),
  permission: "complaint.create",
  handler: async ({ mediaId }, { user }) => {
    if (!aiEnabled()) throw new ActionError(OFF);

    const media = await db.media.findUnique({
      where: { id: mediaId },
      select: {
        url: true,
        kind: true,
        mimeType: true,
        uploadedById: true,
        complaint: { select: { citizenId: true, departmentId: true, assignedToId: true } },
      },
    });
    if (!media || media.uploadedById !== user.id) throw new ActionError("Recording not found.");
    if (media.kind !== "AUDIO") throw new ActionError("That file is not a recording.");

    const file = await fetch(media.url);
    if (!file.ok) throw new ActionError("Could not read that recording.");
    const data = Buffer.from(await file.arrayBuffer()).toString("base64");

    const text = await transcribeAudio({
      data,
      mimeType: media.mimeType ?? "audio/webm",
    });
    if (!text) throw new ActionError("Could not make out any words. Type it instead?");

    return { text };
  },
});

/** Translate a complaint on demand, and remember the result on the row. */
export const translateComplaint = defineAction({
  name: "complaint.translate",
  entity: "complaint",
  schema: z.object({ id: z.string().min(1), language: z.string().min(2).max(8) }),
  permission: "complaint.create",
  handler: async ({ id, language }, { user }) => {
    const complaint = await db.complaint.findUnique({
      where: { id },
      select: {
        title: true,
        description: true,
        aiMeta: true,
        citizenId: true,
        departmentId: true,
        assignedToId: true,
      },
    });
    if (!complaint || !canViewComplaint(user, complaint)) {
      throw new ActionError("Complaint not found.");
    }

    // Translations are immutable once made — the complaint text never changes.
    const meta = aiMetaOf(complaint.aiMeta);
    const cached = meta?.translations?.[language];
    if (cached) return cached;

    if (!aiEnabled()) throw new ActionError(OFF);

    const translated = await translateComplaintText({
      title: complaint.title,
      description: complaint.description,
      targetLanguage: language,
    });
    if (!translated) throw new ActionError("Could not translate this right now.");

    const next: AiMeta = {
      ...(meta ?? { status: "ok" }),
      translations: { ...(meta?.translations ?? {}), [language]: translated },
    };
    await db.complaint.update({
      where: { id },
      data: { aiMeta: next as Prisma.InputJsonValue },
    });

    return translated;
  },
});

/** A draft reply for an officer to edit. Never sent automatically. */
export const suggestResponse = defineAction({
  name: "complaint.suggest_response",
  entity: "complaint",
  schema: z.object({ id: z.string().min(1) }),
  permission: "complaint.view_all",
  handler: async ({ id }, { user }) => {
    if (!aiEnabled()) throw new ActionError(OFF);

    const complaint = await db.complaint.findUnique({
      where: { id },
      select: {
        title: true,
        description: true,
        status: true,
        language: true,
        citizenId: true,
        departmentId: true,
        assignedToId: true,
        department: { select: { name: true } },
        timeline: {
          where: { isPublic: true },
          select: { note: true, toStatus: true, createdAt: true },
          orderBy: { createdAt: "asc" },
          take: 20,
        },
      },
    });
    if (!complaint || !canViewComplaint(user, complaint)) {
      throw new ActionError("Complaint not found.");
    }

    const draft = await suggestOfficerResponse({
      title: complaint.title,
      description: complaint.description,
      status: STATUS_LABEL[complaint.status],
      department: complaint.department?.name,
      language: complaint.language,
      history: complaint.timeline.map(
        (entry) =>
          `${entry.createdAt.toISOString().slice(0, 10)}: ${
            entry.toStatus ? STATUS_LABEL[entry.toStatus] : "note"
          }${entry.note ? ` — ${entry.note}` : ""}`,
      ),
    });
    if (!draft) throw new ActionError("Could not draft a reply right now.");

    return { draft };
  },
});
