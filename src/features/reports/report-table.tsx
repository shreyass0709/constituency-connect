import type { ReportTable } from "./queries";

/** One table for all five reports, and the same markup the print view uses. */
export function ReportTableView({ report }: { report: ReportTable }) {
  if (report.rows.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed p-8 text-center text-muted-foreground">
        Nothing to report yet.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-2xl border">
      <table className="w-full text-sm">
        <caption className="sr-only">{report.title}</caption>
        <thead className="bg-muted/50 text-left">
          <tr>
            {report.headers.map((header, index) => (
              <th
                key={header}
                scope="col"
                className={index === 0 ? "px-4 py-3 font-medium" : "px-4 py-3 text-right font-medium"}
              >
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {report.rows.map((row, rowIndex) => (
            <tr key={rowIndex} className="border-t">
              {row.map((cell, cellIndex) => (
                <td
                  key={cellIndex}
                  className={
                    cellIndex === 0 ? "px-4 py-3" : "px-4 py-3 text-right tabular-nums"
                  }
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
