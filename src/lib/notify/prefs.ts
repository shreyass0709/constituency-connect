import { z } from "zod";

/**
 * Per-user channel switches (`User.notificationPrefs`). The in-app bell is not listed
 * because it is not optional — it is the record of what happened, and the fallback for
 * every other channel that is off, unconfigured or broken.
 */
export const notificationPrefsSchema = z.object({
  push: z.boolean().default(true),
  email: z.boolean().default(true),
});

export type NotificationPrefs = z.infer<typeof notificationPrefsSchema>;

export const DEFAULT_PREFS: NotificationPrefs = { push: true, email: true };

/** Null, legacy shapes and junk all fall back to "everything on". */
export function prefsOf(value: unknown): NotificationPrefs {
  const parsed = notificationPrefsSchema.safeParse(value ?? {});
  return parsed.success ? parsed.data : DEFAULT_PREFS;
}
