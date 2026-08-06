import { z } from "zod";
import { ComplaintCategory, MediaKind, MediaStage, Priority } from "@/generated/prisma/enums";

// Client parses these for UX, the action parses them again for truth
// (docs/02-architecture.md §8, "validation doctrine").

const coordinate = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});

/** Saved at every step of the wizard, so nothing here may be required yet. */
export const saveDraftSchema = z.object({
  id: z.string().optional(),
  title: z.string().trim().max(120).optional(),
  description: z.string().trim().max(4000).optional(),
  category: z.enum(ComplaintCategory).optional(),
  latitude: z.number().min(-90).max(90).nullish(),
  longitude: z.number().min(-180).max(180).nullish(),
  address: z.string().trim().max(200).nullish(),
  landmark: z.string().trim().max(200).nullish(),
  villageId: z.string().nullish(),
  isPrivate: z.boolean().optional(),
});

/**
 * What a draft must contain before it can go to the office. Location stays optional on
 * purpose — a citizen with GPS off should still be heard; the ward falls back to their
 * home ward at submit time.
 */
export const submittableSchema = z.object({
  title: z.string().trim().min(5, "Give it a short title (at least 5 characters)."),
  description: z.string().trim().min(15, "Tell us a little more — at least 15 characters."),
  category: z.enum(ComplaintCategory),
});

export const submitComplaintSchema = z.object({ id: z.string().min(1) });

export const complaintIdSchema = z.object({ id: z.string().min(1) });

export const attachMediaSchema = z.object({
  complaintId: z.string().min(1),
  kind: z.enum(MediaKind),
  /** Omitted by the citizen's wizard; set explicitly by field proof and signatures. */
  stage: z.enum(MediaStage).optional(),
  url: z.url(),
  publicId: z.string().min(1),
  mimeType: z.string().max(120).nullish(),
  sizeBytes: z.number().int().positive().nullish(),
  ...coordinate.partial().shape,
});

export const removeMediaSchema = z.object({ id: z.string().min(1) });

// ── Triage ──────────────────────────────────────────────────────────────────

export const categorizeSchema = z.object({
  id: z.string().min(1),
  category: z.enum(ComplaintCategory),
  priority: z.enum(Priority),
  departmentId: z.string().nullish(),
});

export const assignSchema = z.object({
  ids: z.array(z.string().min(1)).min(1).max(50),
  departmentId: z.string().min(1, "Pick a department."),
  officerId: z.string().nullish(),
  estimatedCompletion: z.coerce.date().nullish(),
});

export const rejectSchema = z.object({
  id: z.string().min(1),
  reason: z.string().trim().min(10, "Tell the citizen why, in at least 10 characters."),
});

export const mergeSchema = z.object({
  id: z.string().min(1),
  originalCode: z.string().trim().min(3, "Enter the original complaint's code."),
});

export const escalateSchema = z.object({
  id: z.string().min(1),
  note: z.string().trim().min(5, "Add a short note.").max(1000),
});

// ── Field officer ───────────────────────────────────────────────────────────

export const workNoteSchema = z.object({
  id: z.string().min(1),
  note: z.string().trim().min(3, "Write a short note.").max(1000),
});

export const completeWorkSchema = z.object({
  id: z.string().min(1),
  note: z.string().trim().max(1000).optional(),
  signatureMediaId: z.string().nullish(),
});

// ── Citizen close-out ───────────────────────────────────────────────────────

export const reopenSchema = z.object({
  id: z.string().min(1),
  reason: z.string().trim().min(10, "Tell us what is still wrong.").max(1000),
});

export const feedbackSchema = z.object({
  id: z.string().min(1),
  rating: z.number().int().min(1).max(5),
  feedbackText: z.string().trim().max(1000).nullish(),
});

export type SaveDraftInput = z.infer<typeof saveDraftSchema>;
