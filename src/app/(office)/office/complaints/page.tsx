import Link from "next/link";
import { Inbox, Search } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CATEGORIES, CATEGORY_LABEL, STATUS_LABEL } from "@/constants/status";
import type { ComplaintCategory, ComplaintStatus } from "@/generated/prisma/enums";
import { requireUser } from "@/lib/auth/require-user";
import { ComplaintList } from "@/features/complaints/complaint-list";
import { listComplaints } from "@/features/complaints/queries";

export const metadata = { title: "Complaints" };

const STATUSES = Object.keys(STATUS_LABEL).filter((s) => s !== "DRAFT") as ComplaintStatus[];

export default async function OfficeComplaintsPage({
  searchParams,
}: PageProps<"/office/complaints">) {
  const user = await requireUser("complaint.view_all");
  const params = await searchParams;

  const status = typeof params.status === "string" ? params.status : "";
  const category = typeof params.category === "string" ? params.category : "";
  const q = typeof params.q === "string" ? params.q : "";
  const page = Number(params.page) || 1;

  const { items, meta } = await listComplaints(user, {
    status: STATUSES.includes(status as ComplaintStatus) ? (status as ComplaintStatus) : undefined,
    category: CATEGORIES.includes(category as ComplaintCategory)
      ? (category as ComplaintCategory)
      : undefined,
    q: q || undefined,
    page,
  });

  const pageLink = (next: number) => {
    const search = new URLSearchParams();
    if (status) search.set("status", status);
    if (category) search.set("category", category);
    if (q) search.set("q", q);
    search.set("page", String(next));
    return `/office/complaints?${search}`;
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">Complaints</h1>
        <p className="text-muted-foreground">{meta.total} in view.</p>
      </div>

      {/* A plain GET form: filters live in the URL, so a view can be shared or bookmarked. */}
      <form className="flex flex-wrap items-end gap-3 rounded-2xl border p-4" method="get">
        <div className="grid gap-1">
          <label htmlFor="status" className="text-xs text-muted-foreground">
            Status
          </label>
          <select
            id="status"
            name="status"
            defaultValue={status}
            className="h-9 rounded-md border bg-transparent px-3 text-sm"
          >
            <option value="">Any</option>
            {STATUSES.map((value) => (
              <option key={value} value={value}>
                {STATUS_LABEL[value]}
              </option>
            ))}
          </select>
        </div>

        <div className="grid gap-1">
          <label htmlFor="category" className="text-xs text-muted-foreground">
            Category
          </label>
          <select
            id="category"
            name="category"
            defaultValue={category}
            className="h-9 rounded-md border bg-transparent px-3 text-sm"
          >
            <option value="">Any</option>
            {CATEGORIES.map((value) => (
              <option key={value} value={value}>
                {CATEGORY_LABEL[value]}
              </option>
            ))}
          </select>
        </div>

        <div className="grid flex-1 gap-1">
          <label htmlFor="q" className="text-xs text-muted-foreground">
            Search
          </label>
          <Input id="q" name="q" defaultValue={q} placeholder="Code, title or words in the description" />
        </div>

        <Button type="submit" variant="outline">
          <Search />
          Filter
        </Button>
      </form>

      {items.length > 0 ? (
        <>
          <ComplaintList complaints={items} basePath="/office/complaints" />
          {meta.totalPages > 1 ? (
            <nav className="flex items-center justify-between text-sm" aria-label="Pagination">
              {meta.page > 1 ? (
                <Link className="text-primary hover:underline" href={pageLink(meta.page - 1)}>
                  ← Previous
                </Link>
              ) : (
                <span />
              )}
              <span className="text-muted-foreground">
                Page {meta.page} of {meta.totalPages}
              </span>
              {meta.page < meta.totalPages ? (
                <Link className="text-primary hover:underline" href={pageLink(meta.page + 1)}>
                  Next →
                </Link>
              ) : (
                <span />
              )}
            </nav>
          ) : null}
        </>
      ) : (
        <EmptyState
          icon={Inbox}
          title="Nothing matches"
          description="No complaint fits those filters. Widen the search and try again."
        />
      )}
    </div>
  );
}
