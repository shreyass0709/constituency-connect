import { generateText } from "./gemini";

/**
 * Narrative on top of numbers the database already computed. The AI never counts
 * anything here — it is handed the aggregates and asked to say what they mean, so a
 * hallucinated figure is impossible by construction (docs/02-architecture.md §5).
 */

const SYSTEM = `You write short internal briefings for a constituency representative.

- Use ONLY the figures given. Never estimate, extrapolate or invent a number.
- Lead with what changed, not with what stayed the same.
- Name the trade-off honestly: if resolution slowed, say so.
- No praise, no party language, no adjectives doing the work of evidence.
- Four sentences at most. Plain English.`;

export async function writeMonthlySummary(input: {
  month: string;
  raised: number;
  resolved: number;
  resolutionRate: number;
  previousResolutionRate: number;
  avgResolutionDays: number | null;
  satisfaction: number | null;
  topCategories: { category: string; count: number }[];
  busiestWards: { ward: string; count: number }[];
}): Promise<string | null> {
  return generateText({
    system: SYSTEM,
    temperature: 0.3,
    maxOutputTokens: 400,
    prompt: `Month: ${input.month}
Complaints raised: ${input.raised}
Complaints resolved: ${input.resolved}
Resolution rate: ${input.resolutionRate}% (previous month ${input.previousResolutionRate}%)
Average days to resolve: ${input.avgResolutionDays?.toFixed(1) ?? "not enough data"}
Average satisfaction: ${input.satisfaction?.toFixed(1) ?? "not enough ratings"} out of 5
Busiest categories: ${input.topCategories.map((c) => `${c.category} (${c.count})`).join(", ") || "none"}
Busiest wards: ${input.busiestWards.map((w) => `${w.ward} (${w.count})`).join(", ") || "none"}

Write the briefing.`,
  });
}

export async function phraseHotspots(
  hotspots: { ward: string; category: string; recent: number; previous: number }[],
): Promise<string | null> {
  if (hotspots.length === 0) return null;

  return generateText({
    system: SYSTEM,
    temperature: 0.3,
    maxOutputTokens: 300,
    prompt: `These ward/category pairs have risen sharply in the last four weeks compared with
the four before. Say what is happening and what it might warrant looking at. Do not add
causes you were not given — if drainage is rising before a monsoon, you may note the
season, nothing more.

${hotspots
  .map((h) => `${h.ward} · ${h.category}: ${h.recent} recent vs ${h.previous} before`)
  .join("\n")}`,
  });
}
