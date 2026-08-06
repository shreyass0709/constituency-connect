import { requireUser } from "@/lib/auth/require-user";
import { db } from "@/lib/db";
import { formatDate } from "@/lib/utils";
import { buildReport, isReportType } from "@/features/reports/queries";
import { ReportTableView } from "@/features/reports/report-table";

export const metadata = { title: "Report (print)" };

/**
 * The "PDF export": a page laid out for the browser's own print dialog.
 *
 * ponytail: no PDF library and no headless browser. Every machine that opens this
 * already has a PDF writer behind Ctrl+P, and a server-side renderer would be a whole
 * dependency and a cold start to reproduce what it does.
 */
export default async function ReportPrintPage({
  searchParams,
}: PageProps<"/office/reports/print">) {
  await requireUser("reports.export");
  const { type } = await searchParams;
  const active = isReportType(typeof type === "string" ? type : null) ? type : "ward";

  const [report, representative] = await Promise.all([
    buildReport(active),
    db.representative.findFirst({ select: { name: true, constituencyName: true } }),
  ]);

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6 bg-white p-8 text-black print:p-0">
      <header className="flex flex-col gap-1 border-b pb-4">
        <p className="text-xs uppercase tracking-widest text-neutral-500">
          {representative?.constituencyName ?? "Constituency"} · Office of{" "}
          {representative?.name ?? "the representative"}
        </p>
        <h1 className="font-heading text-2xl font-semibold">{report.title}</h1>
        <p className="text-sm text-neutral-500">Generated {formatDate(new Date())}</p>
      </header>

      <ReportTableView report={report} />

      <p className="text-xs text-neutral-500 print:fixed print:bottom-4">
        Constituency Connect · figures drawn live from the complaint record.
      </p>
    </div>
  );
}
