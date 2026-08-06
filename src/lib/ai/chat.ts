import { streamText } from "./gemini";

/**
 * The public FAQ assistant. Grounded: it is handed the office's own FAQs, schemes and
 * representative profile, and told to answer from those or say it does not know. A
 * government-facing bot that invents an eligibility rule is worse than no bot, so the
 * escape hatch — "raise a concern" — is part of the instruction, not an afterthought.
 */

export type ChatTurn = { role: "user" | "assistant"; content: string };

export type ChatGrounding = {
  representative?: { name: string; constituencyName: string; officeHours?: string | null } | null;
  faqs: { question: string; answer: string }[];
  schemes: { title: string; summary: string; eligibility: string }[];
};

const SYSTEM = `You are the assistant on a constituency office's public website.

Rules, in order of importance:
1. Answer ONLY from the reference material below. If it does not cover the question, say
   so plainly and point the person to raising a concern or contacting the office.
2. Never invent eligibility rules, amounts, deadlines, phone numbers or names.
3. If someone is describing a civic problem — a pothole, no water, a broken light — tell
   them to tap "Raise a Concern" and that they will get a tracking code.
4. Be brief: two or three sentences. Reply in the language the person used.
5. You cannot look up an individual complaint. For that, direct them to the Track page
   with their code.`;

export function groundingText(grounding: ChatGrounding): string {
  const parts: string[] = [];

  if (grounding.representative) {
    parts.push(
      `OFFICE\n${grounding.representative.name}, ${grounding.representative.constituencyName}` +
        (grounding.representative.officeHours
          ? `\nOffice hours: ${grounding.representative.officeHours}`
          : ""),
    );
  }
  if (grounding.faqs.length) {
    parts.push(
      `FAQS\n${grounding.faqs.map((faq) => `Q: ${faq.question}\nA: ${faq.answer}`).join("\n\n")}`,
    );
  }
  if (grounding.schemes.length) {
    parts.push(
      `SCHEMES\n${grounding.schemes
        .map((s) => `${s.title}: ${s.summary}\nEligibility: ${s.eligibility}`)
        .join("\n\n")}`,
    );
  }

  return parts.join("\n\n") || "No reference material is available.";
}

export async function streamChatReply(input: {
  history: ChatTurn[];
  grounding: ChatGrounding;
}): Promise<ReadableStream<Uint8Array> | null> {
  // A short FAQ exchange flattens into one prompt cleanly — multi-turn `contents` would
  // buy nothing here and cost a more complicated client.
  const conversation = input.history
    .slice(-6)
    .map((turn) => `${turn.role === "user" ? "Person" : "Assistant"}: ${turn.content}`)
    .join("\n");

  return streamText({
    system: SYSTEM,
    temperature: 0.3,
    maxOutputTokens: 400,
    prompt: `REFERENCE MATERIAL
${groundingText(input.grounding)}

CONVERSATION
${conversation}
Assistant:`,
  });
}
