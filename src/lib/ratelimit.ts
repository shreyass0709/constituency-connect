/**
 * Sliding-window limiter for the surfaces docs/02-architecture.md §8 declares:
 * OTP 3/10 min/phone, auth 10/hr/IP, complaint submit 5/day/user, chat 10/min/user,
 * public API 60/min/IP.
 *
 * Backed by Upstash Redis when `UPSTASH_REDIS_REST_URL`/`_TOKEN` are set (the locked
 * choice — serverless instances share one window), and by an in-memory map otherwise,
 * which is what dev and CI run on. Upstash errors fall through to the in-memory path
 * rather than failing the request: a limiter that takes the site down is worse than
 * one that occasionally counts low.
 */

export type RateLimitResult = { ok: boolean; remaining: number; retryAfterSeconds: number };

const hits = new Map<string, number[]>();

function memoryLimit(key: string, limit: number, windowMs: number): RateLimitResult {
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

/**
 * One pipelined round trip: drop expired members, add this hit, count, set the TTL.
 * A blocked caller's own hit is removed afterwards so repeated attempts cannot extend
 * their own penalty — the correction is best-effort, and a missed one only means the
 * caller waits out the window.
 *
 * ponytail: raw REST rather than @upstash/ratelimit — four commands and no new
 * dependency. Swap in the SDK if we ever need its analytics or multi-region replicas.
 */
async function redisLimit(
  url: string,
  token: string,
  key: string,
  limit: number,
  windowMs: number,
): Promise<RateLimitResult> {
  const now = Date.now();
  const member = `${now}-${Math.random().toString(36).slice(2)}`;
  const redisKey = `rl:${key}`;

  const response = await fetch(`${url}/pipeline`, {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify([
      ["ZREMRANGEBYSCORE", redisKey, 0, now - windowMs],
      ["ZADD", redisKey, now, member],
      ["ZCARD", redisKey],
      ["PEXPIRE", redisKey, windowMs],
    ]),
    cache: "no-store",
  });

  if (!response.ok) throw new Error(`Upstash responded ${response.status}`);

  const results = (await response.json()) as ({ result?: unknown; error?: string } | null)[];
  const count = Number(results[2]?.result);
  if (!Number.isFinite(count)) throw new Error("Upstash returned no count");

  if (count > limit) {
    void fetch(`${url}/zrem/${encodeURIComponent(redisKey)}/${encodeURIComponent(member)}`, {
      method: "POST",
      headers: { authorization: `Bearer ${token}` },
      cache: "no-store",
    }).catch(() => {});

    return { ok: false, remaining: 0, retryAfterSeconds: Math.ceil(windowMs / 1000) };
  }

  return { ok: true, remaining: limit - count, retryAfterSeconds: 0 };
}

export async function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
): Promise<RateLimitResult> {
  // Read live rather than through `env`: this module is imported by vitest and by
  // scripts that have no full environment, and both must still get the memory limiter.
  // `lib/env.ts` is where the pair is validated at boot.
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (url && token) {
    try {
      return await redisLimit(url, token, key, limit, windowMs);
    } catch (error) {
      console.error("[ratelimit] Upstash unavailable, falling back to memory:", error);
    }
  }

  return memoryLimit(key, limit, windowMs);
}

/** Test seam: the module-level map would otherwise leak between cases. */
export function resetRateLimits() {
  hits.clear();
}

/** Vercel puts the real client first in x-forwarded-for; everything after it is a proxy. */
export function clientIp(request: Request): string {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "anonymous";
}

/**
 * The route-handler shape of the check: returns a ready 429 when the caller is over,
 * or `null` when they may proceed. Every limited route reads the same three lines.
 */
export async function limitOr429(
  key: string,
  limit: number,
  windowMs: number,
  message: string,
): Promise<Response | null> {
  const result = await rateLimit(key, limit, windowMs);
  if (result.ok) return null;

  return Response.json(
    // `message` is repeated at the top level because the Better Auth client reads it
    // there; without it a throttled sign-in showed a generic "could not send the code".
    { error: { code: "RATE_LIMITED", message }, message },
    { status: 429, headers: { "retry-after": String(result.retryAfterSeconds) } },
  );
}
