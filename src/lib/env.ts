import { z } from "zod";

// Fail fast at boot on a missing/malformed secret rather than at the first request.
// Server-side only: Next never exposes non-NEXT_PUBLIC_ vars to the client bundle, so
// an accidental client import fails validation loudly instead of leaking anything.
// Vars get added here as each feature lands (docs/02-architecture.md §7).

/**
 * An unset variable and one set to the empty string mean the same thing to an operator —
 * "I don't have this" — so they must mean the same thing here. Without this, a blank
 * `GEMINI_API_KEY=` in a dashboard takes the whole app down at boot instead of quietly
 * disabling one optional feature.
 */
const optional = (inner: z.ZodType<string>) =>
  z.preprocess((value) => (value === "" ? undefined : value), inner.optional());

const schema = z.object({
  DATABASE_URL: z.string().min(1),
  BETTER_AUTH_SECRET: z.string().min(32),
  BETTER_AUTH_URL: z.url(),
  SMS_PROVIDER: z.enum(["console", "msg91"]).default("console"),
  /** Required only when SMS_PROVIDER=msg91; `sendOtpSms` throws if one is missing. */
  MSG91_AUTH_KEY: optional(z.string().min(1)),
  MSG91_TEMPLATE_ID: optional(z.string().min(1)),
  // Optional: without them the app runs fine, photo/voice attachments just stay off.
  CLOUDINARY_CLOUD_NAME: optional(z.string().min(1)),
  CLOUDINARY_API_KEY: optional(z.string().min(1)),
  CLOUDINARY_API_SECRET: optional(z.string().min(1)),
  /** Shared secret the cron routes require in `x-cron-secret`. */
  CRON_SECRET: optional(z.string().min(16)),
  /** Both or neither — without them rate limits are per-instance instead of global. */
  UPSTASH_REDIS_REST_URL: optional(z.url()),
  UPSTASH_REDIS_REST_TOKEN: optional(z.string().min(1)),

  // ── Notification channels (all optional; a missing channel is simply skipped) ──
  RESEND_API_KEY: optional(z.string().min(1)),
  EMAIL_FROM: optional(z.string().min(1)),
  /** Public origin used to build absolute links in emails and push payloads. */
  APP_URL: optional(z.url()),
  /** FCM HTTP v1 service account — the three fields we actually need from its JSON. */
  FCM_PROJECT_ID: optional(z.string().min(1)),
  FCM_CLIENT_EMAIL: optional(z.string().min(1)),
  FCM_PRIVATE_KEY: optional(z.string().min(1)),

  // ── Error reporting (optional; unset means Sentry stays off entirely) ──
  SENTRY_DSN: optional(z.url()),
  NEXT_PUBLIC_SENTRY_DSN: optional(z.url()),

  // ── AI (optional; every AI feature has a deterministic fallback) ──
  GEMINI_API_KEY: optional(z.string().min(1)),
  /** Knob, not a constant: model names move faster than releases do. */
  GEMINI_MODEL: z.string().min(1).default("gemini-2.5-flash"),
  // AI_ENABLED is deliberately NOT parsed here — `aiEnabled()` reads it live so the kill
  // switch can be flipped inside a test or a script without re-importing the world.
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  throw new Error(
    `Invalid environment:\n${z.prettifyError(parsed.error)}\nSee .env.example.`,
  );
}

export const env = parsed.data;
