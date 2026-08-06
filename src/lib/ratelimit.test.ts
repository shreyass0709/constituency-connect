import { afterEach, describe, expect, it, vi } from "vitest";
import { limitOr429, rateLimit, resetRateLimits } from "./ratelimit";

afterEach(() => {
  resetRateLimits();
  vi.useRealTimers();
});

describe("rateLimit", () => {
  it("allows up to the limit and then refuses", async () => {
    for (let i = 0; i < 3; i++) {
      expect((await rateLimit("user-1", 3, 60_000)).ok).toBe(true);
    }
    const blocked = await rateLimit("user-1", 3, 60_000);
    expect(blocked.ok).toBe(false);
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("counts each caller separately", async () => {
    expect((await rateLimit("user-1", 1, 60_000)).ok).toBe(true);
    expect((await rateLimit("user-1", 1, 60_000)).ok).toBe(false);
    expect((await rateLimit("user-2", 1, 60_000)).ok).toBe(true);
  });

  it("lets the window slide", async () => {
    vi.useFakeTimers();
    expect((await rateLimit("user-1", 2, 1_000)).ok).toBe(true);
    expect((await rateLimit("user-1", 2, 1_000)).ok).toBe(true);
    expect((await rateLimit("user-1", 2, 1_000)).ok).toBe(false);

    vi.advanceTimersByTime(1_001);
    expect((await rateLimit("user-1", 2, 1_000)).ok).toBe(true);
  });

  it("reports how much of the allowance is left", async () => {
    expect((await rateLimit("user-1", 3, 60_000)).remaining).toBe(2);
    expect((await rateLimit("user-1", 3, 60_000)).remaining).toBe(1);
    expect((await rateLimit("user-1", 3, 60_000)).remaining).toBe(0);
  });
});

describe("limitOr429", () => {
  it("returns nothing while the caller is under, then a 429 with retry-after", async () => {
    expect(await limitOr429("route-1", 1, 60_000, "Slow down.")).toBeNull();

    const response = await limitOr429("route-1", 1, 60_000, "Slow down.");
    expect(response?.status).toBe(429);
    expect(Number(response?.headers.get("retry-after"))).toBeGreaterThan(0);
    await expect(response?.json()).resolves.toMatchObject({
      error: { code: "RATE_LIMITED", message: "Slow down." },
    });
  });
});
