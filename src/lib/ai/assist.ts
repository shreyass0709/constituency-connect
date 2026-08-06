import { z } from "zod";
import { generateJson, generateText, type Part } from "./gemini";

/**
 * The three "help a human write something" calls. All of them hand text back to a person
 * who then edits and sends it — nothing here is ever published or delivered on its own.
 */

/**
 * Voice note → editable text. Plenty of citizens would rather speak than type, and a
 * transcript is what makes the rest of the pipeline (tagging, search) work on what they
 * said. Audio is sent inline, which is fine for the 20 MB voice-note ceiling.
 */
export async function transcribeAudio(input: {
  data: string; // base64
  mimeType: string;
}): Promise<string | null> {
  const parts: Part[] = [
    {
      text: `Transcribe this voice note verbatim, in the language it was spoken.
Return only the transcript — no preamble, no quotation marks, no translation.
If it is inaudible, return an empty string.`,
    },
    { inlineData: { mimeType: input.mimeType, data: input.data } },
  ];
  const text = await generateText({ prompt: parts, temperature: 0 });
  return text?.trim() || null;
}

const translationSchema = z.object({ title: z.string(), description: z.string() });

export async function translateComplaintText(input: {
  title: string;
  description: string;
  targetLanguage: string;
}): Promise<{ title: string; description: string } | null> {
  return generateJson(
    {
      system: `You translate civic complaints for a government office. Translate faithfully and
plainly. Keep names, places, and complaint codes exactly as written. Do not summarise,
soften, or add anything.`,
      responseSchema: {
        type: "object",
        properties: { title: { type: "string" }, description: { type: "string" } },
        required: ["title", "description"],
      },
      temperature: 0,
      prompt: `Target language code: ${input.targetLanguage}

Title: ${input.title}
Description: ${input.description}`,
    },
    (value) => {
      const parsed = translationSchema.safeParse(value);
      return parsed.success ? parsed.data : null;
    },
  );
}

/**
 * A first draft of what the officer might say back. Deliberately returns plain text into
 * an editable box: it is a starting point, never an auto-reply.
 */
export async function suggestOfficerResponse(input: {
  title: string;
  description: string;
  status: string;
  department?: string | null;
  history: string[];
  language?: string | null;
}): Promise<string | null> {
  const text = await generateText({
    system: `You draft short replies from a constituency office to a citizen about their
complaint. Warm, specific, and honest. Two or three sentences. Never promise a date that
is not already in the history. Never apologise on behalf of anyone. Do not invent facts,
budgets or names. Write in the citizen's language.`,
    temperature: 0.4,
    maxOutputTokens: 300,
    prompt: `Complaint: ${input.title}
What the citizen said: ${input.description}
Current status: ${input.status}
Department: ${input.department ?? "not assigned yet"}
Citizen's language: ${input.language ?? "en"}

What has happened so far:
${input.history.map((entry) => `- ${entry}`).join("\n") || "- nothing yet"}

Write the reply only.`,
  });
  return text?.trim() || null;
}
