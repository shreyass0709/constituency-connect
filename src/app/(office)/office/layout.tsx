import { AppShell } from "@/components/shared/app-shell";
import { requireSection } from "@/lib/auth/require-user";
import { unreadCount } from "@/features/notifications/queries";

export default async function OfficeLayout({ children }: LayoutProps<"/office">) {
  const user = await requireSection("/office");
  const unread = await unreadCount(user.id);
  return (
    <AppShell user={user} section="/office" unreadCount={unread}>
      {children}
    </AppShell>
  );
}
