import * as Sentry from "@sentry/nextjs";

/**
 * Server-side error reporting (docs/06-roadmap.md Phase 6). Without `SENTRY_DSN` every
 * call below is a no-op, which is what dev, CI and any deployment without the key get —
 * the same "configure it or it quietly stays off" rule as email, push and AI.
 */
export async function register() {
  if (!process.env.SENTRY_DSN) return;

  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV,
    // A civic site's traffic is small and its budget smaller: sample traces, keep errors.
    tracesSampleRate: 0.1,
    // Citizen text is the one thing that must not leave the box.
    sendDefaultPii: false,
  });
}

export const onRequestError = Sentry.captureRequestError;
