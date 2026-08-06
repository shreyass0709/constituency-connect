import { AppShell } from "@/components/shared/app-shell";
import { requireSection } from "@/lib/auth/require-user";

export default async function FieldLayout({ children }: LayoutProps<"/field">) {
  const user = await requireSection("/field");
  return (
    <AppShell user={user} section="/field">
      {children}
    </AppShell>
  );
}
