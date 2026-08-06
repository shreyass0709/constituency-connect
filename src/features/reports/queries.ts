import { db } from "@/lib/db";

/**
 * The five reports the office actually asks for (docs/01 FR-10). Each returns the same
 * shape — a title, column headers and rows — so one table component renders any of them,
 * one CSV route exports any of them, and one print view prints any of them.
 */

export const REPORT_TYPES = ["ward", "department", "monthly", "yearly", "officer"] as const;
export type ReportType = (typeof REPORT_TYPES)[number];

export type ReportTable = {
  type: ReportType;
  title: string;
  headers: string[];
  rows: (string | number)[][];
};

const RESOLVED = ["COMPLETED", "CLOSED"] as const;

/** Average days from raised to completed, per group, in one SQL pass. */
type Aggregate = { key: string; total: number; resolved: number; avgDays: number | null; rating: number | null };

const GROUPABLE = ["wardId", "departmentId", "assignedToId"] as const;

async function aggregateBy(
  column: (typeof GROUPABLE)[number],
): Promise<Map<string, Aggregate>> {
  // Column names cannot be bound as parameters, so the only safe version of this query
  // is one where the name can never come from a request. The type says so; this checks
  // it at runtime too, because that is the guarantee the security doctrine actually
  // wants (docs/02-architecture.md §8, "no raw SQL string interpolation").
  if (!GROUPABLE.includes(column)) throw new Error(`Refusing to group by ${column}`);

  const rows = await db.$queryRawUnsafe<
    { key: string | null; total: bigint; resolved: bigint; avg_days: number | null; avg_rating: number | null }[]
  >(`
    SELECT "${column}" AS key,
           COUNT(*) AS total,
           COUNT(*) FILTER (WHERE "status" IN ('COMPLETED','CLOSED')) AS resolved,
           AVG(EXTRACT(EPOCH FROM ("completedAt" - "createdAt")) / 86400)
             FILTER (WHERE "completedAt" IS NOT NULL) AS avg_days,
           AVG("rating") FILTER (WHERE "rating" IS NOT NULL) AS avg_rating
    FROM "Complaint"
    WHERE "status" <> 'DRAFT'
    GROUP BY "${column}"
  `);

  return new Map(
    rows
      .filter((row) => row.key)
      .map((row) => [
        row.key!,
        {
          key: row.key!,
          total: Number(row.total),
          resolved: Number(row.resolved),
          avgDays: row.avg_days === null ? null : Number(row.avg_days),
          rating: row.avg_rating === null ? null : Number(row.avg_rating),
        },
      ]),
  );
}

const rate = (resolved: number, total: number) =>
  total === 0 ? "0%" : `${Math.round((resolved / total) * 100)}%`;

const days = (value: number | null) => (value === null ? "—" : value.toFixed(1));
const stars = (value: number | null) => (value === null ? "—" : value.toFixed(1));

export async function buildReport(type: ReportType): Promise<ReportTable> {
  switch (type) {
    case "ward": {
      const [wards, stats] = await Promise.all([
        db.ward.findMany({ select: { id: true, number: true, name: true }, orderBy: { number: "asc" } }),
        aggregateBy("wardId"),
      ]);
      return {
        type,
        title: "Complaints by ward",
        headers: ["Ward", "Raised", "Resolved", "Resolution rate", "Avg days", "Avg rating"],
        rows: wards.map((ward) => {
          const stat = stats.get(ward.id);
          return [
            ward.name,
            stat?.total ?? 0,
            stat?.resolved ?? 0,
            rate(stat?.resolved ?? 0, stat?.total ?? 0),
            days(stat?.avgDays ?? null),
            stars(stat?.rating ?? null),
          ];
        }),
      };
    }

    case "department": {
      const [departments, stats] = await Promise.all([
        db.department.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
        aggregateBy("departmentId"),
      ]);
      return {
        type,
        title: "Complaints by department",
        headers: ["Department", "Raised", "Resolved", "Resolution rate", "Avg days", "Avg rating"],
        rows: departments.map((department) => {
          const stat = stats.get(department.id);
          return [
            department.name,
            stat?.total ?? 0,
            stat?.resolved ?? 0,
            rate(stat?.resolved ?? 0, stat?.total ?? 0),
            days(stat?.avgDays ?? null),
            stars(stat?.rating ?? null),
          ];
        }),
      };
    }

    case "officer": {
      const [officers, stats] = await Promise.all([
        db.user.findMany({
          where: { role: { in: ["FIELD_OFFICER", "DEPARTMENT_OFFICER"] } },
          select: { id: true, name: true, department: { select: { name: true } } },
          orderBy: { name: "asc" },
        }),
        aggregateBy("assignedToId"),
      ]);
      return {
        type,
        title: "Officer performance",
        headers: ["Officer", "Department", "Assigned", "Resolved", "Resolution rate", "Avg days"],
        rows: officers.map((officer) => {
          const stat = stats.get(officer.id);
          return [
            officer.name,
            officer.department?.name ?? "—",
            stat?.total ?? 0,
            stat?.resolved ?? 0,
            rate(stat?.resolved ?? 0, stat?.total ?? 0),
            days(stat?.avgDays ?? null),
          ];
        }),
      };
    }

    case "monthly":
    case "yearly": {
      // Same rule as above: a literal chosen here, never a value that arrived over HTTP.
      const unit: "month" | "year" = type === "monthly" ? "month" : "year";
      const limit = type === "monthly" ? 24 : 10;
      const rows = await db.$queryRawUnsafe<
        {
          period: Date;
          total: bigint;
          resolved: bigint;
          avg_days: number | null;
          avg_rating: number | null;
        }[]
      >(`
        SELECT date_trunc('${unit}', "createdAt") AS period,
               COUNT(*) AS total,
               COUNT(*) FILTER (WHERE "status" IN ('COMPLETED','CLOSED')) AS resolved,
               AVG(EXTRACT(EPOCH FROM ("completedAt" - "createdAt")) / 86400)
                 FILTER (WHERE "completedAt" IS NOT NULL) AS avg_days,
               AVG("rating") FILTER (WHERE "rating" IS NOT NULL) AS avg_rating
        FROM "Complaint"
        WHERE "status" <> 'DRAFT'
        GROUP BY 1
        ORDER BY 1 DESC
        LIMIT ${limit}
      `);

      return {
        type,
        title: type === "monthly" ? "Month by month" : "Year by year",
        headers: [
          type === "monthly" ? "Month" : "Year",
          "Raised",
          "Resolved",
          "Resolution rate",
          "Avg days",
          "Avg rating",
        ],
        rows: rows.map((row) => [
          type === "monthly"
            ? new Date(row.period).toISOString().slice(0, 7)
            : new Date(row.period).getFullYear(),
          Number(row.total),
          Number(row.resolved),
          rate(Number(row.resolved), Number(row.total)),
          days(row.avg_days === null ? null : Number(row.avg_days)),
          stars(row.avg_rating === null ? null : Number(row.avg_rating)),
        ]),
      };
    }
  }
}

export function isReportType(value: string | null): value is ReportType {
  return REPORT_TYPES.includes(value as ReportType);
}

export { RESOLVED };
