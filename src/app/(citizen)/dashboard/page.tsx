import { MessageSquarePlus } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import { requireUser } from "@/lib/auth/require-user";

export const metadata = { title: "Dashboard" };

export default async function CitizenDashboard() {
  const user = await requireUser();

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">
          Namaste, {user.name.split(" ")[0]}
        </h1>
        <p className="text-muted-foreground">Your concerns and their progress live here.</p>
      </div>
      <EmptyState
        icon={MessageSquarePlus}
        title="No concerns raised yet"
        description="Raising a concern arrives in Phase 1 — the wizard, tracking and timeline all land together."
      />
    </div>
  );
}
