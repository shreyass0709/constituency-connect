import { z } from "zod";
import { generateJson } from "./gemini";

/**
 * The *second* half of duplicate detection. SQL does the finding — same category, within
 * a stone's throw, last 30 days — and Gemini only answers "is this the same problem?"
 * about the handful that survived. Semantic search over every complaint would be a
 * pgvector project; this is a bounding box and one cheap call
 * (docs/06-roadmap.md, deliberately cut).
 */

const confirmSchema = z.object({
  duplicateOfCode: z.string().nullable(),
  confidence: z.number().min(0).max(1),
  reason: z.string().max(200),
});

export type DuplicateVerdict = z.infer<typeof confirmSchema>;

const responseSchema = {
  type: "object",
  properties: {
    duplicateOfCode: { type: "string", nullable: true },
    confidence: { type: "number" },
    reason: { type: "string" },
  },
  required: ["duplicateOfCode", "confidence", "reason"],
};

const SYSTEM = `You decide whether a new civic complaint reports the SAME physical problem
as one already on file. Two complaints about the same street are only duplicates if they
describe the same fault at the same spot. Different faults nearby — a pothole and a broken
street light on one road — are NOT duplicates. When unsure, answer null.`;

export async function confirmDuplicate(input: {
  candidate: { title: string; description: string };
  existing: { code: string; title: string; description: string; distanceMeters: number }[];
}): Promise<DuplicateVerdict | null> {
  if (input.existing.length === 0) return null;

  return generateJson(
    {
      system: SYSTEM,
      responseSchema,
      temperature: 0,
      prompt: `New complaint
Title: ${input.candidate.title}
Description: ${input.candidate.description}

Already on file nearby:
${input.existing
  .map(
    (item) =>
      `[${item.code}] (${item.distanceMeters} m away) ${item.title} — ${item.description}`,
  )
  .join("\n")}

Which of these, if any, is the same problem? Answer with its code or null.`,
    },
    (value) => {
      const parsed = confirmSchema.safeParse(value);
      if (!parsed.success) return null;
      const known = input.existing.some((item) => item.code === parsed.data.duplicateOfCode);
      return known ? parsed.data : { ...parsed.data, duplicateOfCode: null };
    },
  );
}
