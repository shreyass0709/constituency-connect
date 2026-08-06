import Link from "next/link";
import { Clock, Flame, Inbox, Star, TrendingDown, TrendingUp } from "lucide-react";
import { StatCard } from "@/components/shared/stat-card";
import { CategoryChart, SatisfactionChart, TrendChart } from "@/components/shared/chart-card";
import { CATEGORY_LABEL } from "@/constants/status";
import type { ComplaintCategory } from "@/generated/prisma/enums";
import { requireUser } from "@/lib/auth/require-user";
import { formatDate } from "@/lib/utils";
import {
  categoryBreakdown,
  complaintsTrend,
  detectHotspots,
  headlineStats,
  latestReports,
  satisfactionTrend,
} from "@/features/analytics/queries";

export const metadata = { title: "Analytics" };

export default async function AnalyticsPage() {
  await requireUser("analytics.view");

  const [headline, trend, categories, satisfaction, hotspots, reports] = await Promise.all([
    headlineStats(),
    complaintsTrend(30),
    categoryBreakdown(),
    satisfactionTrend(12),
    detectHotspots(),
    latestReports(),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">Analytics</h1>
        <p className="text-muted-foreground">
          How the constituency is doing, and where the pressure is building.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Raised today" value={headline.raisedToday} icon={Inbox} />
        <StatCard label="Still open" value={headline.pending} icon={Clock} />
        <StatCard
          label="Resolution rate (30d)"
          value={`${headline.resolutionRate}%`}
          icon={headline.resolutionRateDelta >= 0 ? TrendingUp : TrendingDown}
        />
        <StatCard
          label="Satisfaction"
          value={
            headline.satisfaction === null ? "—" : `${headline.satisfaction.toFixed(1)} / 5`
          }
          icon={Star}
        />
      </div>

      <p className="text-sm text-muted-foreground">
        {headline.resolutionRateDelta === 0
          ? "Resolution rate is level with the previous 30 days."
          : `Resolution rate is ${Math.abs(headline.resolutionRateDelta)} points ${
              headline.resolutionRateDelta > 0 ? "up on" : "down on"
            } the previous 30 days.`}
        {headline.avgResolutionDays !== null
          ? ` Average resolution takes ${headline.avgResolutionDays.toFixed(1)} days` +
            (headline.avgResolutionDaysDelta !== null && headline.avgResolutionDaysDelta !== 0
              ? `, ${Math.abs(headline.avgResolutionDaysDelta)} ${
                  headline.avgResolutionDaysDelta < 0 ? "faster" : "slower"
                } than before.`
              : ".")
          : ""}
        {headline.satisfactionCount > 0
          ? ` Based on ${headline.satisfactionCount} rating${headline.satisfactionCount === 1 ? "" : "s"}.`
          : ""}
      </p>

      {hotspots.length > 0 ? (
        <section className="flex flex-col gap-3 rounded-2xl border border-amber-500/40 bg-amber-500/5 p-5">
          <h2 className="flex items-center gap-2 font-medium">
            <Flame className="size-4 text-amber-600 dark:text-amber-400" aria-hidden />
            Building up
          </h2>
          <ul className="flex flex-col gap-1 text-sm">
            {hotspots.map((hotspot) => (
              <li key={`${hotspot.wardId}-${hotspot.category}`}>
                <span className="font-medium">{hotspot.ward}</span> ·{" "}
                {CATEGORY_LABEL[hotspot.category as ComplaintCategory] ?? hotspot.category} —{" "}
                {hotspot.recent} in the last four weeks, against {hotspot.previous} in the four
                before.
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <TrendChart
          title="Complaints over 30 days"
          data={trend}
          xKey="date"
          series={[
            { key: "raised", label: "Raised" },
            { key: "resolved", label: "Resolved", colour: "var(--chart-2, #16a34a)" },
          ]}
        />
        <CategoryChart
          title="By category"
          data={categories.map((row) => ({
            label: CATEGORY_LABEL[row.category],
            count: row.count,
          }))}
        />
        <SatisfactionChart title="Satisfaction trend" data={satisfaction} />

        <section className="flex flex-col gap-3 rounded-2xl border p-5">
          <h2 className="font-medium">Generated reports</h2>
          {reports.length > 0 ? (
            <ul className="flex flex-col gap-3">
              {reports.map((report) => (
                <li key={report.id} className="flex flex-col gap-1">
                  <span className="text-sm font-medium">{report.title}</span>
                  <span className="text-xs text-muted-foreground">
                    {formatDate(report.periodStart)}
                  </span>
                  <p className="whitespace-pre-wrap text-sm text-muted-foreground">
                    {report.body}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">
              The monthly summary and weekly hotspot report appear here once the crons have
              run.{" "}
              <Link href="/office/reports" className="text-primary hover:underline">
                The tables
              </Link>{" "}
              are available now.
            </p>
          )}
        </section>
      </div>
    </div>
  );
}
