import { AppShell } from "@/components/shared/app-shell";
import { requireSection } from "@/lib/auth/require-user";

export default async function DepartmentLayout({ children }: LayoutProps<"/department">) {
  const user = await requireSection("/department");
  return (
    <AppShell user={user} section="/department">
      {children}
    </AppShell>
  );
}
