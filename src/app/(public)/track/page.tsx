import Link from "next/link";
import { Search } from "lucide-react";
import { StatusChip } from "@/components/shared/status-chip";
import { Timeline } from "@/components/shared/timeline";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CATEGORY_LABEL, STATUS_HINT } from "@/constants/status";
import { formatDate } from "@/lib/utils";
import { getPublicComplaintByCode } from "@/features/complaints/queries";

export const metadata = {
  title: "Track a concern",
  description: "Check the status of a concern with its code — no sign-in needed.",
};

/**
 * No login, no PII: a code holder sees status and public history, never a name, phone
 * or exact address (docs/01 §2 privacy).
 *
 * ponytail: unthrottled. Public rate limits are a Phase 6 line item (Upstash) and cover
 * every public surface at once — a per-page limiter here would just be thrown away.
 */
export default async function TrackPage({ searchParams }: PageProps<"/track">) {
  const { code } = await searchParams;
  const query = typeof code === "string" ? code.trim() : "";
  const complaint = query ? await getPublicComplaintByCode(query) : null;

  return (
    <section className="mx-auto flex w-full max-w-2xl flex-col gap-8 px-4 py-16">
      <div className="flex flex-col gap-2 text-center">
        <h1 className="font-heading text-3xl font-semibold tracking-tight">Track a concern</h1>
        <p className="text-muted-foreground">
          Enter the code from your confirmation, for example CC-2026-01042.
        </p>
      </div>

      <form method="get" className="flex gap-2">
        <Input
          name="code"
          defaultValue={query}
          placeholder="CC-2026-01042"
          aria-label="Complaint code"
          className="font-mono"
        />
        <Button type="submit">
          <Search />
          Track
        </Button>
      </form>

      {query && !complaint ? (
        <p className="rounded-2xl border border-dashed p-6 text-center text-muted-foreground">
          No concern found with that code. Check for a typo, or{" "}
          <Link href="/login" className="text-primary hover:underline">
            sign in
          </Link>{" "}
          to see everything you have raised.
        </p>
      ) : null}

      {complaint ? (
        <article className="flex flex-col gap-6 rounded-2xl border p-6">
          <header className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-sm text-muted-foreground">{complaint.code}</span>
              <StatusChip status={complaint.status} />
            </div>
            <h2 className="font-heading text-xl font-semibold">{complaint.title}</h2>
            <p className="text-sm text-muted-foreground">{STATUS_HINT[complaint.status]}</p>
          </header>

          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-xs uppercase tracking-wide text-muted-foreground">Category</dt>
              <dd className="font-medium">{CATEGORY_LABEL[complaint.category]}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-muted-foreground">Ward</dt>
              <dd className="font-medium">{complaint.ward?.name ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-muted-foreground">Department</dt>
              <dd className="font-medium">{complaint.department?.name ?? "Not routed yet"}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-muted-foreground">Raised</dt>
              <dd className="font-medium">{formatDate(complaint.createdAt)}</dd>
            </div>
          </dl>

          <div className="flex flex-col gap-3">
            <h3 className="text-sm font-medium text-muted-foreground">History</h3>
            <Timeline entries={complaint.timeline} />
          </div>
        </article>
      ) : null}
    </section>
  );
}
