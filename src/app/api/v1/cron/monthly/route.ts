import { NextResponse } from "next/server";
import { writeMonthlySummary } from "@/lib/ai/reports";
import { cronAuthorized } from "@/lib/cron-auth";
import { db } from "@/lib/db";
import { notifyUsers } from "@/lib/notify";

/**
 * The monthly briefing. Every figure is a SQL aggregate computed here; the AI is handed
 * those numbers and asked to say what they mean. With no AI, the numbers are stored on
 * their own — a table without a narrative, which is the documented fallback.
 */
export async function GET(request: Request) {
  if (!cronAuthorized(request)) {
    return NextResponse.json(
      { error: { code: "FORBIDDEN", message: "Not for you." } },
      { status: 403 },
    );
  }

  // The month that just ended, not the one we are in.
  const now = new Date();
  const periodStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const periodEnd = new Date(now.getFullYear(), now.getMonth(), 1);
  const previousStart = new Date(now.getFullYear(), now.getMonth() - 2, 1);

  const [current, previous, categories, wards] = await Promise.all([
    monthStats(periodStart, periodEnd),
    monthStats(previousStart, periodStart),
    db.complaint.groupBy({
      by: ["category"],
      where: { createdAt: { gte: periodStart, lt: periodEnd }, status: { not: "DRAFT" } },
      _count: { _all: true },
      orderBy: { _count: { category: "desc" } },
      take: 3,
    }),
    db.complaint.groupBy({
      by: ["wardId"],
      where: { createdAt: { gte: periodStart, lt: periodEnd }, status: { not: "DRAFT" } },
      _count: { _all: true },
      orderBy: { _count: { wardId: "desc" } },
      take: 3,
    }),
  ]);

  const wardNames = await db.ward.findMany({
    where: { id: { in: wards.map((row) => row.wardId).filter((id): id is string => !!id) } },
    select: { id: true, name: true },
  });

  const month = periodStart.toISOString().slice(0, 7);
  const facts = {
    month,
    raised: current.total,
    resolved: current.resolved,
    resolutionRate: current.rate,
    previousResolutionRate: previous.rate,
    avgResolutionDays: current.avgDays,
    satisfaction: current.rating,
    topCategories: categories.map((row) => ({
      category: row.category,
      count: row._count._all,
    })),
    busiestWards: wards.map((row) => ({
      ward: wardNames.find((ward) => ward.id === row.wardId)?.name ?? "Unassigned",
      count: row._count._all,
    })),
  };

  const narrative = await writeMonthlySummary(facts);
  const fallback =
    `${current.total} complaints raised, ${current.resolved} resolved ` +
    `(${current.rate}%, previous month ${previous.rate}%). ` +
    (current.avgDays === null
      ? "Not enough completed work to average a resolution time."
      : `Average resolution ${current.avgDays.toFixed(1)} days.`);

  const report = await db.report.upsert({
    where: { kind_periodStart: { kind: "MONTHLY_SUMMARY", periodStart } },
    create: {
      kind: "MONTHLY_SUMMARY",
      periodStart,
      periodEnd,
      title: `Monthly summary — ${month}`,
      body: narrative ?? fallback,
      meta: facts,
      aiGenerated: Boolean(narrative),
    },
    update: {
      body: narrative ?? fallback,
      meta: facts,
      aiGenerated: Boolean(narrative),
    },
    select: { id: true, title: true, body: true },
  });

  const leadership = await db.user.findMany({
    where: { role: { in: ["REPRESENTATIVE", "ADMIN", "SUPER_ADMIN"] }, isActive: true },
    select: { id: true },
  });
  await notifyUsers(
    leadership.map((person) => person.id),
    {
      type: "report.monthly",
      title: report.title,
      body: report.body.slice(0, 200),
      link: "/office/analytics",
    },
  );

  return NextResponse.json({ data: { month, aiGenerated: Boolean(narrative) } });
}

async function monthStats(from: Date, to: Date) {
  const [row] = await db.$queryRaw<
    { total: bigint; resolved: bigint; avg_days: number | null; avg_rating: number | null }[]
  >`
    SELECT COUNT(*) AS total,
           COUNT(*) FILTER (WHERE "status" IN ('COMPLETED','CLOSED')) AS resolved,
           AVG(EXTRACT(EPOCH FROM ("completedAt" - "createdAt")) / 86400)
             FILTER (WHERE "completedAt" IS NOT NULL) AS avg_days,
           AVG("rating") FILTER (WHERE "rating" IS NOT NULL) AS avg_rating
    FROM "Complaint"
    WHERE "status" <> 'DRAFT' AND "createdAt" >= ${from} AND "createdAt" < ${to}
  `;

  const total = Number(row?.total ?? 0);
  const resolved = Number(row?.resolved ?? 0);
  return {
    total,
    resolved,
    rate: total === 0 ? 0 : Math.round((resolved / total) * 100),
    avgDays: row?.avg_days == null ? null : Number(row.avg_days),
    rating: row?.avg_rating == null ? null : Number(row.avg_rating),
  };
}
