import { AppShell } from "@/components/shared/app-shell";
import { requireSection } from "@/lib/auth/require-user";
import { unreadCount } from "@/features/notifications/queries";

export default async function DepartmentLayout({ children }: LayoutProps<"/department">) {
  const user = await requireSection("/department");
  const unread = await unreadCount(user.id);
  return (
    <AppShell user={user} section="/department" unreadCount={unread}>
      {children}
    </AppShell>
  );
}
