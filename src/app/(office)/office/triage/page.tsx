import Link from "next/link";
import { Inbox } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import { requireUser } from "@/lib/auth/require-user";
import { db } from "@/lib/db";
import { assignmentOptions, listComplaints } from "@/features/complaints/queries";
import { TriageBoard } from "@/features/triage/triage-board";

export const metadata = { title: "Triage" };

const TABS = {
  new: { label: "New", filters: { status: "SUBMITTED" as const } },
  acknowledged: { label: "Acknowledged", filters: { status: "ACKNOWLEDGED" as const } },
  overdue: { label: "Past SLA", filters: { overdue: true } },
  escalated: { label: "Escalated", filters: { escalated: true } },
};

export default async function TriagePage({ searchParams }: PageProps<"/office/triage">) {
  const user = await requireUser("complaint.triage");
  const { tab } = await searchParams;
  const active = (typeof tab === "string" && tab in TABS ? tab : "new") as keyof typeof TABS;

  const [{ items }, options, counts] = await Promise.all([
    listComplaints(user, { ...TABS[active].filters, limit: 50 }),
    assignmentOptions(),
    Promise.all([
      db.complaint.count({ where: { status: "SUBMITTED" } }),
      db.complaint.count({ where: { status: "ACKNOWLEDGED" } }),
      db.complaint.count({
        where: {
          dueAt: { lt: new Date() },
          status: { notIn: ["DRAFT", "COMPLETED", "CLOSED", "REJECTED"] },
        },
      }),
      db.complaint.count({
        where: {
          timeline: { some: { type: "ESCALATION" } },
          status: { notIn: ["DRAFT", "CLOSED", "REJECTED"] },
        },
      }),
    ]),
  ]);
  const [newCount, ackCount, overdueCount, escalatedCount] = counts;
  const badges: Record<keyof typeof TABS, number> = {
    new: newCount,
    acknowledged: ackCount,
    overdue: overdueCount,
    escalated: escalatedCount,
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">Triage</h1>
        <p className="text-muted-foreground">
          Acknowledge, route and assign. Tick several to send them together.
        </p>
      </div>

      <nav className="flex flex-wrap gap-1 rounded-xl bg-muted p-1 text-sm" aria-label="Queues">
        {Object.entries(TABS).map(([key, config]) => (
          <Link
            key={key}
            href={`/office/triage?tab=${key}`}
            aria-current={active === key ? "page" : undefined}
            className={
              active === key
                ? "rounded-lg bg-background px-3 py-1.5 font-medium shadow-sm"
                : "rounded-lg px-3 py-1.5 text-muted-foreground"
            }
          >
            {config.label}
            <span className="ml-2 rounded-full bg-muted-foreground/10 px-1.5 text-xs">
              {badges[key as keyof typeof TABS]}
            </span>
          </Link>
        ))}
      </nav>

      {items.length > 0 ? (
        <TriageBoard
          complaints={items}
          departments={options.departments}
          officers={options.officers}
        />
      ) : (
        <EmptyState
          icon={Inbox}
          title="This queue is clear"
          description="Nothing waiting here. Try another tab, or take a breath."
        />
      )}
    </div>
  );
}
