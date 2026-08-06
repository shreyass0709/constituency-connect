import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The Phase 3 gate, in unit form: with no key — or with the switch off — the AI layer
 * must go quiet and hand back `null` *without touching the network*, so every caller
 * takes its deterministic path.
 */

function stubRequiredEnv() {
  vi.stubEnv("DATABASE_URL", "postgresql://user:pass@localhost:5432/db");
  vi.stubEnv("BETTER_AUTH_SECRET", "x".repeat(32));
  vi.stubEnv("BETTER_AUTH_URL", "http://localhost:3000");
}

beforeEach(() => {
  vi.resetModules();
  stubRequiredEnv();
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("with no API key", () => {
  it("reports itself disabled and never calls out", async () => {
    vi.stubEnv("GEMINI_API_KEY", "");
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    const { aiEnabled, generateText, generateJson, streamText } = await import("./gemini");

    expect(aiEnabled()).toBe(false);
    expect(await generateText({ prompt: "hello" })).toBe(null);
    expect(await generateJson({ prompt: "hello", responseSchema: {} }, () => "parsed")).toBe(null);
    expect(await streamText({ prompt: "hello" })).toBe(null);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("leaves complaint classification unanswered rather than guessing", async () => {
    vi.stubEnv("GEMINI_API_KEY", "");
    vi.stubGlobal("fetch", vi.fn());

    const { classifyComplaint } = await import("./intake");
    const result = await classifyComplaint({
      title: "Pothole on Market Road",
      description: "Large pothole near the bus stop.",
      citizenCategory: "ROAD",
      departments: [{ slug: "public-works", name: "Public Works", categories: ["ROAD"] }],
    });

    expect(result).toBe(null);
  });
});

describe("with a key but the switch off", () => {
  it("behaves exactly as if the key were missing", async () => {
    vi.stubEnv("GEMINI_API_KEY", "a-real-looking-key");
    vi.stubEnv("AI_ENABLED", "false");
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    const { aiEnabled, generateText } = await import("./gemini");

    expect(aiEnabled()).toBe(false);
    expect(await generateText({ prompt: "hello" })).toBe(null);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe("with a key and the switch on", () => {
  it("treats a malformed answer as no answer", async () => {
    vi.stubEnv("GEMINI_API_KEY", "a-real-looking-key");
    vi.stubEnv("AI_ENABLED", "true");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({
          candidates: [{ content: { parts: [{ text: '{"category":"NOT_A_CATEGORY"}' }] } }],
        }),
      ),
    );

    const { classifyComplaint } = await import("./intake");
    const result = await classifyComplaint({
      title: "Pothole",
      description: "Deep pothole outside the school gate.",
      citizenCategory: "ROAD",
      departments: [{ slug: "public-works", name: "Public Works", categories: ["ROAD"] }],
    });

    // Nonsense in, nothing out — the complaint goes to the Unclassified queue.
    expect(result).toBe(null);
  });

  it("drops a department slug the model invented", async () => {
    vi.stubEnv("GEMINI_API_KEY", "a-real-looking-key");
    vi.stubEnv("AI_ENABLED", "true");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: JSON.stringify({
                      category: "ROAD",
                      priority: "HIGH",
                      sentiment: "NEGATIVE",
                      language: "en",
                      departmentSlug: "ministry-of-invented-things",
                      summary: "Pothole outside the school gate",
                      confidence: 0.9,
                    }),
                  },
                ],
              },
            },
          ],
        }),
      ),
    );

    const { classifyComplaint } = await import("./intake");
    const result = await classifyComplaint({
      title: "Pothole",
      description: "Deep pothole outside the school gate.",
      citizenCategory: "ROAD",
      departments: [{ slug: "public-works", name: "Public Works", categories: ["ROAD"] }],
    });

    expect(result?.category).toBe("ROAD");
    expect(result?.departmentSlug).toBe(null);
  });
});
