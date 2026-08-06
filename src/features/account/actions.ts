"use server";

import { db } from "@/lib/db";
import { notificationPrefsSchema } from "@/lib/notify/prefs";
import { defineAction } from "@/lib/safe-action";

export const updateNotificationPrefs = defineAction({
  name: "account.update_notification_prefs",
  entity: "user",
  schema: notificationPrefsSchema,
  handler: async (prefs, { user }) => {
    await db.user.update({ where: { id: user.id }, data: { notificationPrefs: prefs } });
    return prefs;
  },
});
