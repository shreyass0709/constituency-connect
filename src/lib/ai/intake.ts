import { z } from "zod";
import { ComplaintCategory, Priority, Sentiment } from "@/generated/prisma/enums";
import { generateJson } from "./gemini";

/**
 * One structured call per complaint — not six (docs/02-architecture.md §5). Everything
 * the office wants to know about a fresh complaint comes back together, or nothing does
 * and the complaint lands in the Unclassified queue for a human.
 */

const CATEGORIES = Object.keys(ComplaintCategory);
const PRIORITIES = Object.keys(Priority);
const SENTIMENTS = Object.keys(Sentiment);

const intakeSchema = z.object({
  category: z.enum(ComplaintCategory),
  priority: z.enum(Priority),
  sentiment: z.enum(Sentiment),
  /** Short code such as "en" or "hi" — what the citizen actually wrote in. */
  language: z.string().min(2).max(8),
  /** Slug from the list we hand it, or null when nothing fits. */
  departmentSlug: z.string().nullable(),
  /** A clean one-line title staff can scan; the citizen's own title stays untouched. */
  summary: z.string().min(3).max(160),
  confidence: z.number().min(0).max(1),
});

export type IntakeResult = z.infer<typeof intakeSchema>;

// Gemini's response schema is the OpenAPI subset, so it is written out rather than
// derived. The Zod parse above is the real guard: a wrong shape is a failed call.
const responseSchema = {
  type: "object",
  properties: {
    category: { type: "string", enum: CATEGORIES },
    priority: { type: "string", enum: PRIORITIES },
    sentiment: { type: "string", enum: SENTIMENTS },
    language: { type: "string" },
    departmentSlug: { type: "string", nullable: true },
    summary: { type: "string" },
    confidence: { type: "number" },
  },
  required: [
    "category",
    "priority",
    "sentiment",
    "language",
    "departmentSlug",
    "summary",
    "confidence",
  ],
};

const SYSTEM = `You triage civic complaints for an Indian constituency office.
Judge only from what the citizen wrote. Be conservative: when the text is vague, say so
with a low confidence rather than guessing a specific department.

Priority guidance:
- URGENT: danger to life, sewage in homes, live wires, no drinking water at all
- HIGH: many people affected, worsening fast, or a repeat of an unfixed problem
- MEDIUM: the ordinary case
- LOW: cosmetic, or an improvement request rather than a fault

Sentiment is how the citizen sounds, not how bad the problem is.
Language is the language they wrote in, as a short code (en, hi, kn, ta…).
summary is one plain-English line an officer can scan. Never invent facts.`;

export async function classifyComplaint(input: {
  title: string;
  description: string;
  citizenCategory: ComplaintCategory;
  ward?: string | null;
  address?: string | null;
  departments: { slug: string; name: string; categories: ComplaintCategory[] }[];
}): Promise<IntakeResult | null> {
  const departments = input.departments
    .map((d) => `- ${d.slug} (${d.name}) handles: ${d.categories.join(", ") || "anything assigned"}`)
    .join("\n");

  return generateJson(
    {
      system: SYSTEM,
      responseSchema,
      temperature: 0,
      prompt: `Departments available:
${departments}

Complaint
Title: ${input.title}
Description: ${input.description}
Category the citizen picked: ${input.citizenCategory}
Ward: ${input.ward ?? "unknown"}
Address: ${input.address ?? "not given"}`,
    },
    (value) => {
      const parsed = intakeSchema.safeParse(value);
      if (!parsed.success) return null;
      // A slug it invented is worse than no slug at all.
      const known = input.departments.some((d) => d.slug === parsed.data.departmentSlug);
      return known ? parsed.data : { ...parsed.data, departmentSlug: null };
    },
  );
}
