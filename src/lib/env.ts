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
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  throw new Error(
    `Invalid environment:\n${z.prettifyError(parsed.error)}\nSee .env.example.`,
  );
}

export const env = parsed.data;
