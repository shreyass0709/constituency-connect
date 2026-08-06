import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth/require-user";
import { prefsOf } from "@/lib/notify/prefs";
import { NotificationSettings } from "@/features/account/notification-settings";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const user = await requireUser();
  const row = await db.user.findUniqueOrThrow({
    where: { id: user.id },
    select: { notificationPrefs: true },
  });

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">How we reach you when something changes.</p>
      </div>
      <NotificationSettings
        initial={prefsOf(row.notificationPrefs)}
        // The client cannot see server secrets, so the server tells it whether the
        // "enable on this device" flow has anything to talk to.
        pushConfigured={Boolean(process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID)}
      />
    </div>
  );
}
