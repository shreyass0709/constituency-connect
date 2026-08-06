import { AppShell } from "@/components/shared/app-shell";
import { requireSection } from "@/lib/auth/require-user";
import { unreadCount } from "@/features/notifications/queries";

export default async function CitizenLayout({ children }: LayoutProps<"/dashboard">) {
  const user = await requireSection("/dashboard");
  const unread = await unreadCount(user.id);
  return (
    <AppShell user={user} section="/dashboard" unreadCount={unread}>
      {children}
    </AppShell>
  );
}
