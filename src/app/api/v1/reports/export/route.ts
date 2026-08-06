import { NextResponse } from "next/server";
import { can } from "@/lib/auth/permissions";
import { getCurrentUser } from "@/lib/auth/require-user";
import { csvResponse, toCsv } from "@/lib/csv";
import { buildReport, isReportType } from "@/features/reports/queries";

/** CSV download for any of the five reports. Staff only — these carry officer names. */
export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user || !can(user.role, "reports.export")) {
    return NextResponse.json(
      { error: { code: "FORBIDDEN", message: "You cannot export reports." } },
      { status: 403 },
    );
  }

  const type = new URL(request.url).searchParams.get("type");
  if (!isReportType(type)) {
    return NextResponse.json(
      { error: { code: "VALIDATION", message: "Unknown report type." } },
      { status: 400 },
    );
  }

  const report = await buildReport(type);
  const stamp = new Date().toISOString().slice(0, 10);

  return csvResponse(
    `${type}-report-${stamp}.csv`,
    toCsv(report.headers, report.rows),
  );
}
