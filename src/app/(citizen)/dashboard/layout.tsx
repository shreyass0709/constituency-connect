import { AppShell } from "@/components/shared/app-shell";
import { requireSection } from "@/lib/auth/require-user";

export default async function CitizenLayout({ children }: LayoutProps<"/dashboard">) {
  const user = await requireSection("/dashboard");
  return (
    <AppShell user={user} section="/dashboard">
      {children}
    </AppShell>
  );
}
