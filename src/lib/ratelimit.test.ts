import { afterEach, describe, expect, it, vi } from "vitest";
import { rateLimit, resetRateLimits } from "./ratelimit";

afterEach(() => {
  resetRateLimits();
  vi.useRealTimers();
});

describe("rateLimit", () => {
  it("allows up to the limit and then refuses", () => {
    for (let i = 0; i < 3; i++) {
      expect(rateLimit("user-1", 3, 60_000).ok).toBe(true);
    }
    const blocked = rateLimit("user-1", 3, 60_000);
    expect(blocked.ok).toBe(false);
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("counts each caller separately", () => {
    expect(rateLimit("user-1", 1, 60_000).ok).toBe(true);
    expect(rateLimit("user-1", 1, 60_000).ok).toBe(false);
    expect(rateLimit("user-2", 1, 60_000).ok).toBe(true);
  });

  it("lets the window slide", () => {
    vi.useFakeTimers();
    expect(rateLimit("user-1", 2, 1_000).ok).toBe(true);
    expect(rateLimit("user-1", 2, 1_000).ok).toBe(true);
    expect(rateLimit("user-1", 2, 1_000).ok).toBe(false);

    vi.advanceTimersByTime(1_001);
    expect(rateLimit("user-1", 2, 1_000).ok).toBe(true);
  });

  it("reports how much of the allowance is left", () => {
    expect(rateLimit("user-1", 3, 60_000).remaining).toBe(2);
    expect(rateLimit("user-1", 3, 60_000).remaining).toBe(1);
    expect(rateLimit("user-1", 3, 60_000).remaining).toBe(0);
  });
});
