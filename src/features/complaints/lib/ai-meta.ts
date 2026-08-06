import { z } from "zod";
import { ComplaintCategory, Priority } from "@/generated/prisma/enums";

/**
 * Everything the AI layer has ever said about a complaint, parked on `Complaint.aiMeta`.
 * It is advisory: routing decisions still belong to a human, so these are *suggestions*
 * the triage row offers in one click, not values silently written over the citizen's.
 *
 * `status` is the field the Unclassified queue keys on — "failed" (or no aiMeta at all)
 * means nobody has looked at this yet, human or machine.
 */
export const aiMetaSchema = z.object({
  status: z.enum(["ok", "failed"]),
  at: z.string().optional(),
  suggestedCategory: z.enum(ComplaintCategory).optional(),
  suggestedPriority: z.enum(Priority).optional(),
  suggestedDepartmentId: z.string().nullish(),
  suggestedDepartmentName: z.string().nullish(),
  confidence: z.number().min(0).max(1).optional(),
  summary: z.string().optional(),
  duplicate: z
    .object({
      id: z.string(),
      code: z.string(),
      confidence: z.number(),
      reason: z.string(),
    })
    .nullish(),
  /** Cached on-demand translations, keyed by language code. */
  translations: z.record(z.string(), z.object({ title: z.string(), description: z.string() })).optional(),
});

export type AiMeta = z.infer<typeof aiMetaSchema>;

export function aiMetaOf(value: unknown): AiMeta | null {
  const parsed = aiMetaSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}
