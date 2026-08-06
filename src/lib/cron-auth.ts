import { env } from "./env";

/**
 * Shared by every cron route. With no `CRON_SECRET` configured nobody may run them —
 * an unauthenticated endpoint that rewrites public counters and closes complaints is not
 * something to leave open by default.
 */
export function cronAuthorized(request: Request): boolean {
  if (!env.CRON_SECRET) return false;
  return (
    request.headers.get("authorization") === `Bearer ${env.CRON_SECRET}` || // Vercel Cron
    request.headers.get("x-cron-secret") === env.CRON_SECRET // a human with curl
  );
}
