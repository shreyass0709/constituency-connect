import { ClipboardList } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import { requireUser } from "@/lib/auth/require-user";

export const metadata = { title: "My tasks" };

export default async function FieldTasks() {
  const user = await requireUser();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">Today</h1>
        <p className="text-muted-foreground">{user.name} · tasks sorted by distance.</p>
      </div>
      <EmptyState
        icon={ClipboardList}
        title="No tasks assigned"
        description="Assignments, proof capture and completion arrive in Phase 2."
      />
    </div>
  );
}
