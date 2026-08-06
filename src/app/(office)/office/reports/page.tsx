import Link from "next/link";
import { Download, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/auth/require-user";
import { buildReport, isReportType, REPORT_TYPES } from "@/features/reports/queries";
import { ReportTableView } from "@/features/reports/report-table";

export const metadata = { title: "Reports" };

const LABELS: Record<string, string> = {
  ward: "By ward",
  department: "By department",
  monthly: "Monthly",
  yearly: "Yearly",
  officer: "By officer",
};

export default async function ReportsPage({ searchParams }: PageProps<"/office/reports">) {
  await requireUser("reports.export");
  const { type } = await searchParams;
  const requested = typeof type === "string" ? type : null;
  const active = isReportType(requested) ? requested : "ward";

  const report = await buildReport(active);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex-1">
          <h1 className="font-heading text-2xl font-semibold tracking-tight">Reports</h1>
          <p className="text-muted-foreground">{report.title}</p>
        </div>
        <Button asChild variant="outline">
          {/* A real download, not a client-side blob — the browser names the file. */}
          <a href={`/api/v1/reports/export?type=${active}`}>
            <Download />
            Export CSV
          </a>
        </Button>
        <Button asChild variant="outline">
          <Link href={`/office/reports/print?type=${active}`} target="_blank">
            <Printer />
            Print / PDF
          </Link>
        </Button>
      </div>

      <nav className="flex flex-wrap gap-1 rounded-xl bg-muted p-1 text-sm" aria-label="Report">
        {REPORT_TYPES.map((value) => (
          <Link
            key={value}
            href={`/office/reports?type=${value}`}
            aria-current={active === value ? "page" : undefined}
            className={
              active === value
                ? "rounded-lg bg-background px-3 py-1.5 font-medium shadow-sm"
                : "rounded-lg px-3 py-1.5 text-muted-foreground"
            }
          >
            {LABELS[value]}
          </Link>
        ))}
      </nav>

      <ReportTableView report={report} />
    </div>
  );
}
