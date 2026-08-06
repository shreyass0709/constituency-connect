import "dotenv/config";
import { db } from "../src/lib/db";
import { listComplaints, complaintCounts } from "../src/features/complaints/queries";
import { listMapPins } from "../src/features/public-site/map";
import { headlineStats, detectHotspots } from "../src/features/analytics/queries";
import { buildReport } from "../src/features/reports/queries";
import type { CurrentUser } from "../src/lib/auth/require-user";

/**
 * Gate M6 load sanity: seed N synthetic complaints, time the queries that back the
 * screens people actually wait on, then delete every row again.
 *
 *   npm run loadcheck            # 100_000 rows, seed → measure → clean
 *   npm run loadcheck -- 20000   # a smaller run
 *   npm run loadcheck -- clean   # delete leftovers from an interrupted run
 *
 * Every row it writes carries the LOAD- code prefix, so cleanup is one deleteMany even
 * if the process is killed halfway.
 */

const PREFIX = "LOAD-";
const BUDGET_MS = 1000; // docs/06-roadmap.md Phase 6: "admin tables + map stay <1 s"
const BATCH = 5_000;

const CATEGORIES = [
  "ROAD", "DRAINAGE", "STREET_LIGHT", "WATER", "ELECTRICITY", "GARBAGE",
  "SCHOOL", "HOSPITAL", "PENSION", "HOUSING", "PUBLIC_SAFETY", "TRANSPORT",
  "AGRICULTURE", "ENVIRONMENT", "OTHER",
] as const;

const STATUSES = [
  "SUBMITTED", "ACKNOWLEDGED", "ASSIGNED", "DEPT_REVIEW", "FIELD_VERIFICATION",
  "IN_PROGRESS", "COMPLETED", "CLOSED", "REJECTED", "REOPENED",
] as const;

const PRIORITIES = ["LOW", "MEDIUM", "HIGH", "URGENT"] as const;

async function clean() {
  const { count } = await db.complaint.deleteMany({ where: { code: { startsWith: PREFIX } } });
  console.log(`Removed ${count.toLocaleString()} load-test complaints.`);
}

async function seed(total: number) {
  const [citizens, wards, departments, officers] = await Promise.all([
    db.user.findMany({ where: { role: "CITIZEN" }, select: { id: true }, take: 50 }),
    db.ward.findMany({ select: { id: true } }),
    db.department.findMany({ select: { id: true } }),
    db.user.findMany({ where: { role: "FIELD_OFFICER" }, select: { id: true }, take: 20 }),
  ]);

  if (citizens.length === 0 || wards.length === 0 || departments.length === 0) {
    throw new Error("Seed the database first (npm run db:seed) — this needs users, wards and departments.");
  }

  const pick = <T,>(list: readonly T[], index: number) => list[index % list.length]!;
  const startedAt = Date.now();

  for (let offset = 0; offset < total; offset += BATCH) {
    const size = Math.min(BATCH, total - offset);
    await db.complaint.createMany({
      data: Array.from({ length: size }, (_, slot) => {
        const index = offset + slot;
        const status = pick(STATUSES, index);
        const createdAt = new Date(Date.now() - (index % 365) * 86_400_000);
        const done = status === "COMPLETED" || status === "CLOSED";

        return {
          code: `${PREFIX}${index.toString().padStart(7, "0")}`,
          title: `Load test complaint ${index}`,
          description:
            "Synthetic row written by scripts/loadcheck.ts. Long enough to be realistic " +
            "for the ILIKE search path, which is the query most likely to fall over first.",
          category: pick(CATEGORIES, index),
          status,
          priority: pick(PRIORITIES, index * 7),
          citizenId: pick(citizens, index).id,
          wardId: pick(wards, index).id,
          departmentId: pick(departments, index * 3).id,
          assignedToId: officers.length > 0 ? pick(officers, index * 5).id : null,
          // A rough Bengaluru box so the map query has real spread to filter over.
          latitude: 12.85 + ((index % 1000) / 1000) * 0.25,
          longitude: 77.45 + ((index % 997) / 997) * 0.3,
          createdAt,
          dueAt: new Date(createdAt.getTime() + 7 * 86_400_000),
          completedAt: done ? new Date(createdAt.getTime() + 4 * 86_400_000) : null,
          closedAt: status === "CLOSED" ? new Date(createdAt.getTime() + 5 * 86_400_000) : null,
          rating: status === "CLOSED" ? (index % 5) + 1 : null,
        };
      }),
      skipDuplicates: true,
    });
    process.stdout.write(`\r  seeded ${Math.min(offset + size, total).toLocaleString()} / ${total.toLocaleString()}`);
  }

  console.log(`\n  took ${((Date.now() - startedAt) / 1000).toFixed(1)}s`);
}

async function time(label: string, run: () => Promise<unknown>) {
  const startedAt = performance.now();
  const result = await run();
  const ms = performance.now() - startedAt;
  const size = Array.isArray(result) ? ` (${result.length} rows)` : "";
  const verdict = ms < BUDGET_MS ? "ok  " : "SLOW";
  console.log(`  ${verdict} ${ms.toFixed(0).padStart(6)} ms  ${label}${size}`);
  return ms;
}

async function main() {
  const arg = process.argv[2];
  if (arg === "clean") return clean();

  const total = Number(arg ?? 100_000);
  if (!Number.isFinite(total) || total <= 0) throw new Error(`Bad row count: ${arg}`);

  const staff = await db.user.findFirst({
    where: { role: { in: ["OFFICE_STAFF", "ADMIN", "SUPER_ADMIN"] } },
    select: {
      id: true, name: true, phone: true, email: true, image: true, role: true,
      language: true, wardId: true, departmentId: true, isActive: true,
    },
  });
  if (!staff) throw new Error("No staff user found — run npm run db:seed first.");

  console.log(`Seeding ${total.toLocaleString()} complaints…`);
  await seed(total);

  try {
    console.log(`\nTiming the screens people wait on (budget ${BUDGET_MS} ms):`);
    const timings = [
      await time("office complaint list, page 1", () => listComplaints(staff as CurrentUser)),
      await time("office complaint list, page 200", () =>
        listComplaints(staff as CurrentUser, { page: 200 }),
      ),
      await time("complaint list filtered by status + ward", () =>
        listComplaints(staff as CurrentUser, { status: "IN_PROGRESS" }),
      ),
      await time("complaint search (ILIKE)", () =>
        listComplaints(staff as CurrentUser, { q: "load test complaint 4242" }),
      ),
      await time("overdue queue", () => listComplaints(staff as CurrentUser, { overdue: true })),
      await time("sidebar counts", () => complaintCounts(staff as CurrentUser)),
      await time("public map pins", () => listMapPins()),
      await time("analytics headline", () => headlineStats()),
      await time("ward hotspots", () => detectHotspots()),
      await time("ward report", () => buildReport("ward")),
      await time("officer report", () => buildReport("officer")),
    ];

    const slow = timings.filter((ms) => ms >= BUDGET_MS).length;
    console.log(
      slow === 0
        ? `\nOK — all ${timings.length} queries under ${BUDGET_MS} ms at ${total.toLocaleString()} complaints.`
        : `\n${slow} of ${timings.length} queries over ${BUDGET_MS} ms — add an index or narrow the select before launch.`,
    );
    if (slow > 0) process.exitCode = 1;
  } finally {
    console.log("\nCleaning up…");
    await clean();
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
