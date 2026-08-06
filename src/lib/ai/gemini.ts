import { env } from "../env";

/**
 * The whole Gemini surface, in one file. Everything above it (`intake`, `duplicates`,
 * `chat`…) is a typed function; nothing outside `lib/ai` ever sees a prompt
 * (docs/02-architecture.md §5).
 *
 * Contract every caller can rely on: **this module never throws**. Timeout, one retry,
 * then `null` — and the feature falls back to its deterministic path. AI is assistive,
 * never load-bearing.
 *
 * ponytail: plain fetch, no SDK. What the SDK would add here is what these forty lines
 * already do — a POST, a timeout, and a JSON parse.
 */

const ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models";
const TIMEOUT_MS = 10_000;

export type Part =
  | { text: string }
  | { inlineData: { mimeType: string; data: string } };

/**
 * The kill switch. `AI_ENABLED` is read live rather than at boot so that a script or a
 * test can turn the whole layer off mid-process and watch the fallbacks take over —
 * which is exactly the Phase 3 gate ("kill the AI key, the complaint still lands").
 */
export function aiEnabled(): boolean {
  return process.env.AI_ENABLED !== "false" && Boolean(env.GEMINI_API_KEY);
}

type Request = {
  /** A bare string is shorthand for a single text part. */
  prompt: string | Part[];
  system?: string;
  /** OpenAPI-subset schema; when present the model must answer with matching JSON. */
  responseSchema?: object;
  temperature?: number;
  maxOutputTokens?: number;
};

function body(request: Request) {
  const parts: Part[] =
    typeof request.prompt === "string" ? [{ text: request.prompt }] : request.prompt;

  return {
    contents: [{ role: "user", parts }],
    ...(request.system && { systemInstruction: { parts: [{ text: request.system }] } }),
    generationConfig: {
      temperature: request.temperature ?? 0.2,
      ...(request.maxOutputTokens && { maxOutputTokens: request.maxOutputTokens }),
      ...(request.responseSchema && {
        responseMimeType: "application/json",
        responseSchema: request.responseSchema,
      }),
    },
  };
}

async function post(path: string, request: Request, attempt = 0): Promise<Response | null> {
  if (!aiEnabled()) return null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(`${ENDPOINT}/${env.GEMINI_MODEL}:${path}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-goog-api-key": env.GEMINI_API_KEY!,
      },
      body: JSON.stringify(body(request)),
      signal: controller.signal,
    });

    // 4xx other than rate limiting is our bug — retrying it just burns the clock twice.
    if (!response.ok) {
      const retryable = response.status === 429 || response.status >= 500;
      console.error("[ai] request failed", response.status, await response.text());
      if (retryable && attempt === 0) return post(path, request, 1);
      return null;
    }
    return response;
  } catch (error) {
    console.error("[ai] request errored", error);
    return attempt === 0 ? post(path, request, 1) : null;
  } finally {
    clearTimeout(timer);
  }
}

function firstText(payload: unknown): string | null {
  const candidate = (payload as { candidates?: { content?: { parts?: { text?: string }[] } }[] })
    ?.candidates?.[0];
  const text = candidate?.content?.parts?.map((part) => part.text ?? "").join("") ?? "";
  return text.trim() || null;
}

export async function generateText(request: Request): Promise<string | null> {
  const response = await post("generateContent", request);
  if (!response) return null;
  try {
    return firstText(await response.json());
  } catch (error) {
    console.error("[ai] could not read the response", error);
    return null;
  }
}

/**
 * Structured output, validated by the caller's Zod schema. A model that answers with the
 * wrong shape is treated exactly like a model that did not answer at all.
 */
export async function generateJson<T>(
  request: Request & { responseSchema: object },
  parse: (value: unknown) => T | null,
): Promise<T | null> {
  const text = await generateText(request);
  if (!text) return null;
  try {
    return parse(JSON.parse(text));
  } catch (error) {
    console.error("[ai] response was not the shape we asked for", error);
    return null;
  }
}

/** Server-sent events from Gemini, re-emitted as plain text chunks for the browser. */
export async function streamText(request: Request): Promise<ReadableStream<Uint8Array> | null> {
  const response = await post("streamGenerateContent?alt=sse", request);
  if (!response?.body) return null;

  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let buffer = "";

  return response.body.pipeThrough(
    new TransformStream<Uint8Array, Uint8Array>({
      transform(chunk, controller) {
        buffer += decoder.decode(chunk, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.startsWith("data:")) continue;
          const payload = line.slice(5).trim();
          if (!payload || payload === "[DONE]") continue;
          try {
            const text = firstText(JSON.parse(payload));
            if (text) controller.enqueue(encoder.encode(text));
          } catch {
            // A half-delivered event: the next chunk completes it.
          }
        }
      },
    }),
  );
}
