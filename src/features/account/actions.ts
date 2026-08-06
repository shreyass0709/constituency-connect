"use server";

import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/require-user";
import { LOCALE_COOKIE, isLocale } from "@/i18n/request";
import { notificationPrefsSchema } from "@/lib/notify/prefs";
import { defineAction, type ActionResult } from "@/lib/safe-action";

/**
 * Not a `defineAction`: the language switcher has to work for anonymous visitors on the
 * public site, and `defineAction` redirects anyone without a session to /login. The
 * cookie is the locale of record; `User.language` follows it so notifications match.
 */
export async function setLanguage(value: string): Promise<ActionResult<{ locale: string }>> {
  if (!isLocale(value)) return { ok: false, error: "That language is not available." };

  (await cookies()).set(LOCALE_COOKIE, value, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });

  const user = await getCurrentUser();
  if (user) {
    await db.user.update({ where: { id: user.id }, data: { language: value } });
  }

  return { ok: true, data: { locale: value } };
}

export const updateNotificationPrefs = defineAction({
  name: "account.update_notification_prefs",
  entity: "user",
  schema: notificationPrefsSchema,
  handler: async (prefs, { user }) => {
    await db.user.update({ where: { id: user.id }, data: { notificationPrefs: prefs } });
    return prefs;
  },
});
