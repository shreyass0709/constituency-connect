import { getTranslations } from "next-intl/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth/require-user";
import { prefsOf } from "@/lib/notify/prefs";
import { LanguageSwitcher } from "@/features/account/language-switcher";
import { NotificationSettings } from "@/features/account/notification-settings";
import { RevokeSessions } from "@/features/account/revoke-sessions";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const user = await requireUser();
  const t = await getTranslations("settings");
  const language = await getTranslations("language");
  const row = await db.user.findUniqueOrThrow({
    where: { id: user.id },
    select: { notificationPrefs: true },
  });

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="text-muted-foreground">{t("subtitle")}</p>
      </div>

      <section className="flex flex-col gap-2 rounded-2xl border p-4">
        <h2 className="font-medium">{language("label")}</h2>
        <p className="text-sm text-muted-foreground">{language("hint")}</p>
        <LanguageSwitcher className="max-w-xs" />
      </section>

      <NotificationSettings
        initial={prefsOf(row.notificationPrefs)}
        // The client cannot see server secrets, so the server tells it whether the
        // "enable on this device" flow has anything to talk to.
        pushConfigured={Boolean(process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID)}
      />

      <RevokeSessions />
    </div>
  );
}
