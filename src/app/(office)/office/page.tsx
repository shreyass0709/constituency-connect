import Link from "next/link";
import { CircleCheckBig, Clock, Inbox, TriangleAlert } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import { StatCard } from "@/components/shared/stat-card";
import { requireUser } from "@/lib/auth/require-user";
import { db } from "@/lib/db";
import { ComplaintList } from "@/features/complaints/complaint-list";
import { listComplaints } from "@/features/complaints/queries";

export const metadata = { title: "Office" };

export default async function OfficeDashboard() {
  const user = await requireUser("complaint.view_all");

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const [today, waiting, overdue, closed, { items: recent }] = await Promise.all([
    db.complaint.count({ where: { createdAt: { gte: startOfDay }, status: { not: "DRAFT" } } }),
    db.complaint.count({ where: { status: { in: ["SUBMITTED", "ACKNOWLEDGED"] } } }),
    db.complaint.count({
      where: {
        dueAt: { lt: new Date() },
        status: { notIn: ["DRAFT", "COMPLETED", "CLOSED", "REJECTED"] },
      },
    }),
    db.complaint.count({ where: { status: "CLOSED" } }),
    listComplaints(user, { limit: 8 }),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">Office dashboard</h1>
        <p className="text-muted-foreground">Signed in as {user.name}.</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Raised today" value={today} icon={Inbox} />
        <StatCard label="Awaiting triage" value={waiting} icon={Clock} href="/office/triage" />
        <StatCard
          label="Past SLA"
          value={overdue}
          icon={TriangleAlert}
          href="/office/triage?tab=overdue"
          tone={overdue > 0 ? "warning" : "default"}
        />
        <StatCard label="Closed" value={closed} icon={CircleCheckBig} />
      </div>

      <section className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <h2 className="font-heading text-lg font-semibold">Latest</h2>
          <Link
            href="/office/complaints"
            className="ml-auto text-sm text-primary underline-offset-4 hover:underline"
          >
            See all
          </Link>
        </div>
        {recent.length > 0 ? (
          <ComplaintList complaints={recent} basePath="/office/complaints" />
        ) : (
          <EmptyState
            icon={Inbox}
            title="No complaints yet"
            description="As soon as a citizen raises one, it appears here and in the triage queue."
          />
        )}
      </section>
    </div>
  );
}
