import { Inbox } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import { requireUser } from "@/lib/auth/require-user";
import { db } from "@/lib/db";

export const metadata = { title: "Department" };

export default async function DepartmentDashboard() {
  const user = await requireUser();
  const department = user.departmentId
    ? await db.department.findUnique({
        where: { id: user.departmentId },
        select: { name: true },
      })
    : null;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">
          {department?.name ?? "Department"} queue
        </h1>
        <p className="text-muted-foreground">Work assigned to your department lands here.</p>
      </div>
      <EmptyState
        icon={Inbox}
        title="Queue is empty"
        description="Department queues and SLA tracking arrive in Phase 2."
      />
    </div>
  );
}
