import { ClipboardList } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import { requireUser } from "@/lib/auth/require-user";
import { ComplaintList } from "@/features/complaints/complaint-list";
import { listComplaints } from "@/features/complaints/queries";

export const metadata = { title: "My tasks" };

export default async function FieldTasks() {
  const user = await requireUser("complaint.field_update");

  const { items } = await listComplaints(user, {
    assignedToId: user.id,
    status: ["ASSIGNED", "DEPT_REVIEW", "FIELD_VERIFICATION", "IN_PROGRESS", "REOPENED"],
    limit: 50,
  });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">My tasks</h1>
        <p className="text-muted-foreground">{user.name} · open assignments.</p>
      </div>

      {items.length > 0 ? (
        // ponytail: newest-first, not distance-sorted. Sorting by distance needs the
        // officer's live position — that lands with the Phase 2 PWA views.
        <ComplaintList complaints={items} basePath="/dashboard/complaints" />
      ) : (
        <EmptyState
          icon={ClipboardList}
          title="No tasks assigned"
          description="When the office assigns you work it appears here, newest first."
        />
      )}
    </div>
  );
}
