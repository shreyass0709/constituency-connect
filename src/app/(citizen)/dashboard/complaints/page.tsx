import Link from "next/link";
import { FileText, MessageSquarePlus } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { OPEN_STATUSES } from "@/constants/status";
import { requireUser } from "@/lib/auth/require-user";
import { formatDate } from "@/lib/utils";
import { ComplaintList } from "@/features/complaints/complaint-list";
import { listComplaints, listMyDrafts } from "@/features/complaints/queries";

export const metadata = { title: "My concerns" };

const TABS = [
  { key: "open", label: "Open" },
  { key: "resolved", label: "Resolved" },
  { key: "all", label: "All" },
] as const;

export default async function MyComplaintsPage({
  searchParams,
}: PageProps<"/dashboard/complaints">) {
  const user = await requireUser("complaint.create");
  const { tab } = await searchParams;
  const active = TABS.find((t) => t.key === tab)?.key ?? "open";

  const [{ items: mine }, drafts] = await Promise.all([
    listComplaints(user, {
      // This surface is "mine" even for staff, who see everything elsewhere.
      citizenId: user.id,
      status:
        active === "open"
          ? [...OPEN_STATUSES]
          : active === "resolved"
            ? ["COMPLETED", "CLOSED", "REJECTED"]
            : undefined,
      limit: 50,
    }),
    listMyDrafts(user.id),
  ]);

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex-1">
          <h1 className="font-heading text-2xl font-semibold tracking-tight">My concerns</h1>
          <p className="text-muted-foreground">Everything you have raised, and where it stands.</p>
        </div>
        <Button asChild>
          <Link href="/dashboard/raise">
            <MessageSquarePlus />
            Raise a concern
          </Link>
        </Button>
      </div>

      <nav className="flex gap-1 rounded-xl bg-muted p-1 text-sm" aria-label="Filter">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={`/dashboard/complaints?tab=${t.key}`}
            aria-current={active === t.key ? "page" : undefined}
            className={
              active === t.key
                ? "rounded-lg bg-background px-3 py-1.5 font-medium shadow-sm"
                : "rounded-lg px-3 py-1.5 text-muted-foreground"
            }
          >
            {t.label}
          </Link>
        ))}
      </nav>

      {drafts.length > 0 ? (
        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-medium text-muted-foreground">Unfinished drafts</h2>
          <ul className="flex flex-col gap-2">
            {drafts.map((draft) => (
              <li key={draft.id}>
                <Link
                  href={`/dashboard/raise?draft=${draft.id}`}
                  className="flex items-center gap-3 rounded-2xl border border-dashed p-4 hover:bg-muted/40"
                >
                  <FileText className="size-4 text-muted-foreground" aria-hidden />
                  <span className="flex-1 truncate">{draft.title || "Untitled concern"}</span>
                  <span className="text-xs text-muted-foreground">
                    saved {formatDate(draft.updatedAt)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {mine.length > 0 ? (
        <ComplaintList complaints={mine} basePath="/dashboard/complaints" />
      ) : (
        <EmptyState
          icon={MessageSquarePlus}
          title="Nothing here yet"
          description="When you raise a concern it appears here with its full history."
          action={
            <Button asChild>
              <Link href="/dashboard/raise">Raise a concern</Link>
            </Button>
          }
        />
      )}
    </div>
  );
}
