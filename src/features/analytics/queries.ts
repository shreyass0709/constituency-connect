import { db } from "@/lib/db";

/**
 * The numbers behind the representative's Monday review (journey J4).
 *
 * Every figure is computed in SQL, not by pulling rows into Node — these queries have to
 * stay flat at 100k complaints (docs/01 §2 scale).
 */

const DAY_MS = 86_400_000;

export type Headline = {
  raisedToday: number;
  pending: number;
  resolutionRate: number;
  resolutionRateDelta: number;
  avgResolutionDays: number | null;
  avgResolutionDaysDelta: number | null;
  satisfaction: number | null;
  satisfactionCount: number;
};

async function windowStats(from: Date, to: Date) {
  const [row] = await db.$queryRaw<
    { total: bigint; resolved: bigint; avg_days: number | null }[]
  >`
    SELECT COUNT(*) AS total,
           COUNT(*) FILTER (WHERE "status" IN ('COMPLETED','CLOSED')) AS resolved,
           AVG(EXTRACT(EPOCH FROM ("completedAt" - "createdAt")) / 86400)
             FILTER (WHERE "completedAt" IS NOT NULL) AS avg_days
    FROM "Complaint"
    WHERE "status" <> 'DRAFT' AND "createdAt" >= ${from} AND "createdAt" < ${to}
  `;

  const total = Number(row?.total ?? 0);
  const resolved = Number(row?.resolved ?? 0);
  return {
    total,
    resolved,
    rate: total === 0 ? 0 : Math.round((resolved / total) * 100),
    avgDays: row?.avg_days === null || row?.avg_days === undefined ? null : Number(row.avg_days),
  };
}

export async function headlineStats(): Promise<Headline> {
  const now = new Date();
  const startOfDay = new Date(now);
  startOfDay.setHours(0, 0, 0, 0);
  const thirtyDaysAgo = new Date(now.getTime() - 30 * DAY_MS);
  const sixtyDaysAgo = new Date(now.getTime() - 60 * DAY_MS);

  const [raisedToday, pending, current, previous, ratings] = await Promise.all([
    db.complaint.count({ where: { createdAt: { gte: startOfDay }, status: { not: "DRAFT" } } }),
    db.complaint.count({
      where: { status: { notIn: ["DRAFT", "CLOSED", "REJECTED", "COMPLETED"] } },
    }),
    windowStats(thirtyDaysAgo, now),
    windowStats(sixtyDaysAgo, thirtyDaysAgo),
    db.complaint.aggregate({ _avg: { rating: true }, _count: { rating: true } }),
  ]);

  return {
    raisedToday,
    pending,
    resolutionRate: current.rate,
    resolutionRateDelta: current.rate - previous.rate,
    avgResolutionDays: current.avgDays,
    avgResolutionDaysDelta:
      current.avgDays === null || previous.avgDays === null
        ? null
        : Number((current.avgDays - previous.avgDays).toFixed(1)),
    satisfaction: ratings._avg.rating ?? null,
    satisfactionCount: ratings._count.rating,
  };
}

/** Daily raised/resolved counts for the trend chart. */
export async function complaintsTrend(days = 30) {
  const from = new Date(Date.now() - days * DAY_MS);
  const rows = await db.$queryRaw<{ day: Date; raised: bigint; resolved: bigint }[]>`
    SELECT date_trunc('day', "createdAt") AS day,
           COUNT(*) AS raised,
           COUNT(*) FILTER (WHERE "status" IN ('COMPLETED','CLOSED')) AS resolved
    FROM "Complaint"
    WHERE "status" <> 'DRAFT' AND "createdAt" >= ${from}
    GROUP BY 1
    ORDER BY 1
  `;

  return rows.map((row) => ({
    date: new Date(row.day).toISOString().slice(0, 10),
    raised: Number(row.raised),
    resolved: Number(row.resolved),
  }));
}

export async function categoryBreakdown() {
  const rows = await db.complaint.groupBy({
    by: ["category"],
    where: { status: { not: "DRAFT" } },
    _count: { _all: true },
    orderBy: { _count: { category: "desc" } },
    take: 8,
  });
  return rows.map((row) => ({ category: row.category, count: row._count._all }));
}

/** Average rating by month — the satisfaction trend the representative checks. */
export async function satisfactionTrend(months = 12) {
  const rows = await db.$queryRaw<{ month: Date; avg_rating: number | null; votes: bigint }[]>`
    SELECT date_trunc('month', "closedAt") AS month,
           AVG("rating") AS avg_rating,
           COUNT("rating") AS votes
    FROM "Complaint"
    WHERE "rating" IS NOT NULL AND "closedAt" IS NOT NULL
    GROUP BY 1
    ORDER BY 1 DESC
    LIMIT ${months}
  `;

  return rows
    .map((row) => ({
      month: new Date(row.month).toISOString().slice(0, 7),
      rating: row.avg_rating === null ? null : Number(Number(row.avg_rating).toFixed(2)),
      votes: Number(row.votes),
    }))
    .reverse();
}

export type Hotspot = {
  wardId: string;
  ward: string;
  category: string;
  recent: number;
  previous: number;
};

/**
 * SQL does the detecting; the AI only phrases it (docs/02-architecture.md §5). A hotspot
 * is a ward+category that has at least tripled — and at least three complaints, so one
 * complaint becoming two is not "a 100% surge".
 */
export async function detectHotspots(): Promise<Hotspot[]> {
  const now = Date.now();
  const recentFrom = new Date(now - 28 * DAY_MS);
  const previousFrom = new Date(now - 56 * DAY_MS);

  const rows = await db.$queryRaw<
    { wardId: string; ward: string; category: string; recent: bigint; previous: bigint }[]
  >`
    SELECT c."wardId"    AS "wardId",
           w."name"      AS ward,
           c."category"::text AS category,
           COUNT(*) FILTER (WHERE c."createdAt" >= ${recentFrom}) AS recent,
           COUNT(*) FILTER (WHERE c."createdAt" >= ${previousFrom} AND c."createdAt" < ${recentFrom}) AS previous
    FROM "Complaint" c
    JOIN "Ward" w ON w."id" = c."wardId"
    WHERE c."status" <> 'DRAFT' AND c."createdAt" >= ${previousFrom}
    GROUP BY 1, 2, 3
    HAVING COUNT(*) FILTER (WHERE c."createdAt" >= ${recentFrom}) >= 3
    ORDER BY recent DESC
    LIMIT 10
  `;

  return rows
    .map((row) => ({
      wardId: row.wardId,
      ward: row.ward,
      category: row.category,
      recent: Number(row.recent),
      previous: Number(row.previous),
    }))
    .filter((row) => row.recent >= Math.max(row.previous * 2, 3));
}

export async function latestReports() {
  return db.report.findMany({
    select: { id: true, kind: true, title: true, body: true, periodStart: true, createdAt: true },
    orderBy: { createdAt: "desc" },
    take: 4,
  });
}
