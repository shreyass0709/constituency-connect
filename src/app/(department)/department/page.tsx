import Link from "next/link";
import { Inbox } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import { OPEN_STATUSES } from "@/constants/status";
import { requireUser } from "@/lib/auth/require-user";
import { db } from "@/lib/db";
import { ComplaintList } from "@/features/complaints/complaint-list";
import { listComplaints } from "@/features/complaints/queries";

export const metadata = { title: "Department" };

const TABS = {
  open: { label: "Open", status: [...OPEN_STATUSES] },
  completed: { label: "Completed", status: ["COMPLETED", "CLOSED"] as const },
  overdue: { label: "Past SLA", status: undefined },
};

export default async function DepartmentQueue({ searchParams }: PageProps<"/department">) {
  // The department scope itself is applied by complaintScopeWhere — this page never
  // has to remember it.
  const user = await requireUser("complaint.dept_update");
  const { tab } = await searchParams;
  const active = (typeof tab === "string" && tab in TABS ? tab : "open") as keyof typeof TABS;

  const [department, { items }] = await Promise.all([
    user.departmentId
      ? db.department.findUnique({ where: { id: user.departmentId }, select: { name: true } })
      : null,
    listComplaints(user, {
      status: TABS[active].status ? [...TABS[active].status] : undefined,
      overdue: active === "overdue",
      limit: 50,
    }),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">
          {department?.name ?? "Department"} queue
        </h1>
        <p className="text-muted-foreground">Work routed to your department lands here.</p>
      </div>

      <nav className="flex flex-wrap gap-1 rounded-xl bg-muted p-1 text-sm" aria-label="Queues">
        {Object.entries(TABS).map(([key, config]) => (
          <Link
            key={key}
            href={`/department?tab=${key}`}
            aria-current={active === key ? "page" : undefined}
            className={
              active === key
                ? "rounded-lg bg-background px-3 py-1.5 font-medium shadow-sm"
                : "rounded-lg px-3 py-1.5 text-muted-foreground"
            }
          >
            {config.label}
          </Link>
        ))}
      </nav>

      {items.length > 0 ? (
        // Officers open complaints on the shared detail route — the one surface every
        // signed-in role may enter.
        <ComplaintList complaints={items} basePath="/dashboard/complaints" />
      ) : (
        <EmptyState
          icon={Inbox}
          title="Queue is empty"
          description="Nothing is waiting on your department right now."
        />
      )}
    </div>
  );
}
