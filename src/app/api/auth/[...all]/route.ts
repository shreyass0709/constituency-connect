import { toNextJsHandler } from "better-auth/next-js";
import { auth } from "@/lib/auth";
import { clientIp, limitOr429 } from "@/lib/ratelimit";

const handlers = toNextJsHandler(auth.handler);

export const { GET } = handlers;

/**
 * 10 attempts an hour per IP on the write side of auth (docs/02 §8) — sign-in, OTP
 * send, verify. GET is left alone because that is session reads, which every page does.
 *
 * ponytail: keyed per path so one exhausted endpoint does not lock a shared office IP
 * out of the rest of auth. Behind carrier NAT this still counts many citizens as one
 * caller; if that bites, key on the submitted phone number instead.
 */
export async function POST(request: Request) {
  // Demo sign-in has no SMS to pay for and no secret code to guess, and one presenter
  // signing in as each role in turn spends ten attempts in minutes.
  if (process.env.DEMO_OTP) return handlers.POST(request);

  const limited = await limitOr429(
    `auth:${clientIp(request)}:${new URL(request.url).pathname}`,
    10,
    3_600_000,
    "Too many attempts. Please try again in a little while.",
  );
  if (limited) return limited;

  return handlers.POST(request);
}
