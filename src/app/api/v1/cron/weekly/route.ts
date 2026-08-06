import { NextResponse } from "next/server";
import { phraseHotspots } from "@/lib/ai/reports";
import { cronAuthorized } from "@/lib/cron-auth";
import { db } from "@/lib/db";
import { notifyUsers } from "@/lib/notify";
import { detectHotspots } from "@/features/analytics/queries";

/**
 * Weekly hotspot sweep. SQL finds the ward/category pairs that are climbing; the AI only
 * phrases the finding, and if it is unavailable the raw comparison is stored instead —
 * the representative still gets the signal, just without the prose.
 */
export async function GET(request: Request) {
  if (!cronAuthorized(request)) {
    return NextResponse.json(
      { error: { code: "FORBIDDEN", message: "Not for you." } },
      { status: 403 },
    );
  }

  const hotspots = await detectHotspots();
  if (hotspots.length === 0) {
    return NextResponse.json({ data: { hotspots: 0, stored: false } });
  }

  const narrative = await phraseHotspots(hotspots);
  const fallback = hotspots
    .map(
      (hotspot) =>
        `${hotspot.ward} · ${hotspot.category}: ${hotspot.recent} in the last four weeks against ${hotspot.previous} before.`,
    )
    .join("\n");

  // Period start is the Monday of this week, which is also the uniqueness key — a
  // re-run on the same week updates the report instead of stacking another one up.
  const periodStart = new Date();
  periodStart.setHours(0, 0, 0, 0);
  periodStart.setDate(periodStart.getDate() - ((periodStart.getDay() + 6) % 7));
  const periodEnd = new Date(periodStart.getTime() + 7 * 86_400_000);

  const report = await db.report.upsert({
    where: { kind_periodStart: { kind: "WEEKLY_HOTSPOTS", periodStart } },
    create: {
      kind: "WEEKLY_HOTSPOTS",
      periodStart,
      periodEnd,
      title: `${hotspots.length} area${hotspots.length === 1 ? "" : "s"} building up`,
      body: narrative ?? fallback,
      meta: hotspots,
      aiGenerated: Boolean(narrative),
    },
    update: {
      title: `${hotspots.length} area${hotspots.length === 1 ? "" : "s"} building up`,
      body: narrative ?? fallback,
      meta: hotspots,
      aiGenerated: Boolean(narrative),
    },
    select: { id: true, title: true },
  });

  const leadership = await db.user.findMany({
    where: { role: { in: ["REPRESENTATIVE", "ADMIN", "SUPER_ADMIN"] }, isActive: true },
    select: { id: true },
  });
  await notifyUsers(
    leadership.map((person) => person.id),
    {
      type: "report.hotspots",
      title: report.title,
      body: (narrative ?? fallback).slice(0, 200),
      link: "/office/analytics",
    },
  );

  return NextResponse.json({
    data: { hotspots: hotspots.length, stored: true, aiGenerated: Boolean(narrative) },
  });
}
