/**
 * A sliding-window limiter.
 *
 * ponytail: in-memory, so the window is per serverless instance rather than global —
 * a determined caller spread across instances gets more than `limit`. That is still the
 * difference between "someone burns our Gemini quota in a loop" and "someone has to work
 * at it". The real limiter is Upstash Redis in Phase 6 (docs/06-roadmap.md); this
 * function's signature is what it will replace, so no call site changes.
 */

const hits = new Map<string, number[]>();

export function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
): { ok: boolean; remaining: number; retryAfterSeconds: number } {
  const now = Date.now();
  const cutoff = now - windowMs;
  const recent = (hits.get(key) ?? []).filter((at) => at > cutoff);

  if (recent.length >= limit) {
    hits.set(key, recent);
    const oldest = recent[0]!;
    return {
      ok: false,
      remaining: 0,
      retryAfterSeconds: Math.max(1, Math.ceil((oldest + windowMs - now) / 1000)),
    };
  }

  recent.push(now);
  hits.set(key, recent);

  // Keep the map from growing without bound on a long-lived instance.
  if (hits.size > 5_000) {
    for (const [otherKey, timestamps] of hits) {
      if (timestamps.every((at) => at <= cutoff)) hits.delete(otherKey);
    }
  }

  return { ok: true, remaining: limit - recent.length, retryAfterSeconds: 0 };
}

/** Test seam: the module-level map would otherwise leak between cases. */
export function resetRateLimits() {
  hits.clear();
}
