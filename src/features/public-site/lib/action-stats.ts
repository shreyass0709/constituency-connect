import { db } from "@/lib/db";

/**
 * The counters the nightly cron recalculates from real rows.
 *
 * A key is only automatic if it appears here. Anything else marked `autoComputed` is
 * left alone and logged — better a stale number than a silent zero on the front page of
 * a government site.
 *
 * "Trees planted" and the like stay manual: no row in this database knows about them.
 */
const FORMULAS: Record<string, () => Promise<number>> = {
  citizens_assisted: async () => {
    const rows = await db.complaint.groupBy({ by: ["citizenId"], where: { status: "CLOSED" } });
    return rows.length;
  },
  complaints_resolved: () => db.complaint.count({ where: { status: "CLOSED" } }),
  roads_improved: () => db.complaint.count({ where: { status: "CLOSED", category: "ROAD" } }),
  water_projects: () => db.complaint.count({ where: { status: "CLOSED", category: "WATER" } }),
  street_lights_fixed: () =>
    db.complaint.count({ where: { status: "CLOSED", category: "STREET_LIGHT" } }),
  projects_completed: () => db.project.count({ where: { status: "COMPLETED" } }),
};

export async function recomputeActionStats(): Promise<{ updated: number; skipped: string[] }> {
  const stats = await db.actionStat.findMany({
    where: { autoComputed: true },
    select: { id: true, key: true },
  });

  let updated = 0;
  const skipped: string[] = [];

  for (const stat of stats) {
    const formula = FORMULAS[stat.key];
    if (!formula) {
      skipped.push(stat.key);
      continue;
    }
    try {
      const value = await formula();
      await db.actionStat.update({ where: { id: stat.id }, data: { value } });
      updated += 1;
    } catch (error) {
      console.error("[stats] could not recompute", stat.key, error);
      skipped.push(stat.key);
    }
  }

  if (skipped.length) console.warn("[stats] no formula for", skipped.join(", "));
  return { updated, skipped };
}
