import { z } from "zod";
import { generateJson } from "./gemini";

/**
 * Turns a resolved complaint into a first draft of a public story. It is a draft in the
 * strict sense: `publishedAt` stays null until a person presses publish, because this is
 * the office speaking in public about a citizen's problem (docs/02-architecture.md §5).
 */

const storySchema = z.object({
  title: z.string().min(5).max(120),
  body: z.string().min(80).max(2500),
});

export type StoryDraft = z.infer<typeof storySchema>;

const SYSTEM = `You write short public "impact stories" for a constituency office's website.

Hard rules:
- NEVER name, describe or hint at the citizen who raised the complaint. No "a resident
  named", no house numbers, no "the family at". Write about the place and the problem.
- Use only the facts given. No invented budgets, dates, quotes or officials' names.
- Plain, warm, factual. No slogans, no party language, no exclamation marks.
- Three short paragraphs: what was wrong, what was done, what is different now.
- The title is a plain description of the fix, not a headline.`;

export async function draftImpactStory(input: {
  category: string;
  ward?: string | null;
  area?: string | null;
  description: string;
  timeline: string[];
  daysToResolve?: number | null;
}): Promise<StoryDraft | null> {
  return generateJson(
    {
      system: SYSTEM,
      responseSchema: {
        type: "object",
        properties: { title: { type: "string" }, body: { type: "string" } },
        required: ["title", "body"],
      },
      temperature: 0.5,
      maxOutputTokens: 900,
      prompt: `Category: ${input.category}
Ward: ${input.ward ?? "not recorded"}
Area: ${input.area ?? "not recorded"}
Days from report to completion: ${input.daysToResolve ?? "not recorded"}

What was reported:
${input.description}

What happened, in order:
${input.timeline.map((entry) => `- ${entry}`).join("\n")}`,
    },
    (value) => {
      const parsed = storySchema.safeParse(value);
      return parsed.success ? parsed.data : null;
    },
  );
}
