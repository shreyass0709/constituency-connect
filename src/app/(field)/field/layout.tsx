import { AppShell } from "@/components/shared/app-shell";
import { requireSection } from "@/lib/auth/require-user";
import { OfflineBanner } from "@/features/field/offline-banner";
import { unreadCount } from "@/features/notifications/queries";

export default async function FieldLayout({ children }: LayoutProps<"/field">) {
  const user = await requireSection("/field");
  const unread = await unreadCount(user.id);
  return (
    <AppShell user={user} section="/field" unreadCount={unread}>
      <div className="flex flex-col gap-4">
        <OfflineBanner />
        {children}
      </div>
    </AppShell>
  );
}
