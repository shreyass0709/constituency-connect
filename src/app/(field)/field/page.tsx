import { ClipboardList } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import { requireUser } from "@/lib/auth/require-user";
import { listComplaints } from "@/features/complaints/queries";
import { TaskList } from "@/features/field/task-list";

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
        <p className="text-muted-foreground">
          {items.length} open · nearest first once your phone shares its location.
        </p>
      </div>

      {items.length > 0 ? (
        <TaskList tasks={items} />
      ) : (
        <EmptyState
          icon={ClipboardList}
          title="No tasks assigned"
          description="When the office assigns you work it appears here, closest job first."
        />
      )}
    </div>
  );
}
