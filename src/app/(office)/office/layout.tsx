import { AppShell } from "@/components/shared/app-shell";
import { requireSection } from "@/lib/auth/require-user";

export default async function OfficeLayout({ children }: LayoutProps<"/office">) {
  const user = await requireSection("/office");
  return (
    <AppShell user={user} section="/office">
      {children}
    </AppShell>
  );
}
