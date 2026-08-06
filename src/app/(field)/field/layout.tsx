import { AppShell } from "@/components/shared/app-shell";
import { requireSection } from "@/lib/auth/require-user";
import { unreadCount } from "@/features/notifications/queries";

export default async function FieldLayout({ children }: LayoutProps<"/field">) {
  const user = await requireSection("/field");
  const unread = await unreadCount(user.id);
  return (
    <AppShell user={user} section="/field" unreadCount={unread}>
      {children}
    </AppShell>
  );
}
