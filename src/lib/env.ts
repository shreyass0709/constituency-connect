import { z } from "zod";

// Fail fast at boot on a missing/malformed secret rather than at the first request.
// Server-side only: Next never exposes non-NEXT_PUBLIC_ vars to the client bundle, so
// an accidental client import fails validation loudly instead of leaking anything.
// Vars get added here as each feature lands (docs/02-architecture.md §7).
const schema = z.object({
  DATABASE_URL: z.string().min(1),
  BETTER_AUTH_SECRET: z.string().min(32),
  BETTER_AUTH_URL: z.url(),
  SMS_PROVIDER: z.enum(["console", "msg91"]).default("console"),
  // Optional: without them the app runs fine, photo/voice attachments just stay off.
  CLOUDINARY_CLOUD_NAME: z.string().min(1).optional(),
  CLOUDINARY_API_KEY: z.string().min(1).optional(),
  CLOUDINARY_API_SECRET: z.string().min(1).optional(),
  /** Shared secret the cron routes require in `x-cron-secret`. */
  CRON_SECRET: z.string().min(16).optional(),

  // ── Notification channels (all optional; a missing channel is simply skipped) ──
  RESEND_API_KEY: z.string().min(1).optional(),
  EMAIL_FROM: z.string().min(1).optional(),
  /** Public origin used to build absolute links in emails and push payloads. */
  APP_URL: z.url().optional(),
  /** FCM HTTP v1 service account — the three fields we actually need from its JSON. */
  FCM_PROJECT_ID: z.string().min(1).optional(),
  FCM_CLIENT_EMAIL: z.string().min(1).optional(),
  FCM_PRIVATE_KEY: z.string().min(1).optional(),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  throw new Error(
    `Invalid environment:\n${z.prettifyError(parsed.error)}\nSee .env.example.`,
  );
}

export const env = parsed.data;
