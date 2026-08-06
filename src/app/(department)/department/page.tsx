import Link from "next/link";
import { CircleCheckBig, Gauge, Inbox, TriangleAlert } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import { StatCard } from "@/components/shared/stat-card";
import { CATEGORY_LABEL, OPEN_STATUSES } from "@/constants/status";
import { requireUser } from "@/lib/auth/require-user";
import { db } from "@/lib/db";
import { ComplaintList } from "@/features/complaints/complaint-list";
import { departmentStats, listComplaints } from "@/features/complaints/queries";

export const metadata = { title: "Department" };

const TABS = {
  open: { label: "Open" },
  escalated: { label: "Escalated" },
  overdue: { label: "Past SLA" },
  completed: { label: "Completed" },
};

export default async function DepartmentQueue({ searchParams }: PageProps<"/department">) {
  // The department scope itself is applied by complaintScopeWhere — this page never
  // has to remember it.
  const user = await requireUser("complaint.dept_update");
  const { tab } = await searchParams;
  const active = (typeof tab === "string" && tab in TABS ? tab : "open") as keyof typeof TABS;

  const [department, { items }, stats] = await Promise.all([
    user.departmentId
      ? db.department.findUnique({ where: { id: user.departmentId }, select: { name: true } })
      : null,
    listComplaints(user, {
      status:
        active === "open"
          ? [...OPEN_STATUSES]
          : active === "completed"
            ? ["COMPLETED", "CLOSED"]
            : undefined,
      overdue: active === "overdue",
      escalated: active === "escalated",
      limit: 50,
    }),
    user.departmentId ? departmentStats(user.departmentId) : null,
  ]);

  const busiest = stats?.byCategory.slice(0, 5) ?? [];
  const peak = busiest[0]?.count ?? 1;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">
          {department?.name ?? "Department"} queue
        </h1>
        <p className="text-muted-foreground">Work routed to your department lands here.</p>
      </div>

      {stats ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Open" value={stats.open} icon={Inbox} />
            <StatCard
              label="Past SLA"
              value={stats.overdue}
              icon={TriangleAlert}
              href="/department?tab=overdue"
              tone={stats.overdue > 0 ? "warning" : "default"}
            />
            <StatCard
              label="Completed this month"
              value={stats.completedThisMonth}
              icon={CircleCheckBig}
            />
            <StatCard
              label="Avg resolution"
              value={
                stats.avgResolutionDays === null
                  ? "—"
                  : `${stats.avgResolutionDays.toFixed(1)} d`
              }
              icon={Gauge}
            />
          </div>

          {busiest.length > 0 ? (
            <section className="flex flex-col gap-3 rounded-2xl border p-4">
              <h2 className="text-sm font-medium text-muted-foreground">Where the work comes from</h2>
              {/* ponytail: CSS bars, not a chart library. Recharts arrives with the real
                  time-series analytics in Phase 5. */}
              <ul className="flex flex-col gap-2">
                {busiest.map((row) => (
                  <li key={row.category} className="grid grid-cols-[8rem_1fr_2.5rem] items-center gap-3 text-sm">
                    <span className="truncate">{CATEGORY_LABEL[row.category]}</span>
                    <span className="h-2 rounded-full bg-muted">
                      <span
                        className="block h-2 rounded-full bg-primary"
                        style={{ width: `${Math.max((row.count / peak) * 100, 4)}%` }}
                      />
                    </span>
                    <span className="text-right tabular-nums text-muted-foreground">{row.count}</span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </>
      ) : (
        <p className="rounded-2xl border border-dashed p-4 text-sm text-muted-foreground">
          Your account is not linked to a department yet, so you only see your own concerns.
          Ask an admin to set it.
        </p>
      )}

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
          title="Nothing here"
          description="No complaint in your department matches this queue right now."
        />
      )}
    </div>
  );
}
