import Link from "next/link";
import { Clock, Paperclip } from "lucide-react";
import { PriorityBadge, StatusChip } from "@/components/shared/status-chip";
import { CATEGORY_LABEL } from "@/constants/status";
import { cn, formatDate } from "@/lib/utils";
import type { ComplaintCard } from "./queries";

/**
 * One list for every surface that shows complaints — citizen, office, department.
 * Rows on a desktop, stacked cards on a phone; the markup is the same either way.
 */
export function ComplaintList({
  complaints,
  basePath,
  selected,
  onToggle,
}: {
  complaints: ComplaintCard[];
  basePath: string;
  /** Present only when a client parent (the triage board) is running bulk selection. */
  selected?: Set<string>;
  onToggle?: (id: string) => void;
}) {
  return (
    <ul className="flex flex-col gap-2">
      {complaints.map((complaint) => {
        const { overdue, daysLeft } = complaint;
        return (
          <li key={complaint.id} className="rounded-2xl border transition-colors hover:bg-muted/40">
            <div className="flex items-start gap-3 p-4">
              {onToggle ? (
                <input
                  type="checkbox"
                  checked={selected?.has(complaint.id) ?? false}
                  onChange={() => onToggle(complaint.id)}
                  aria-label={`Select ${complaint.code}`}
                  className="mt-1 size-4 accent-primary"
                />
              ) : null}
              <Link href={`${basePath}/${complaint.id}`} className="flex min-w-0 flex-1 flex-col gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-xs text-muted-foreground">{complaint.code}</span>
                  <StatusChip status={complaint.status} />
                  <PriorityBadge priority={complaint.priority} />
                  {overdue ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-red-500/10 px-2.5 py-0.5 text-xs font-medium text-red-600 dark:text-red-300">
                      <Clock className="size-3" aria-hidden />
                      Overdue
                    </span>
                  ) : null}
                </div>
                <p className="truncate font-medium">{complaint.title}</p>
                <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  <span>{CATEGORY_LABEL[complaint.category]}</span>
                  {complaint.ward ? <span>{complaint.ward.name}</span> : null}
                  {complaint.department ? <span>{complaint.department.name}</span> : null}
                  {complaint.assignedTo ? <span>Officer: {complaint.assignedTo.name}</span> : null}
                  <span>Raised {formatDate(complaint.createdAt)}</span>
                  {complaint._count.media > 0 ? (
                    <span className="inline-flex items-center gap-1">
                      <Paperclip className="size-3" aria-hidden />
                      {complaint._count.media}
                    </span>
                  ) : null}
                  {daysLeft !== null ? (
                    <span className={cn(overdue && "text-red-600 dark:text-red-300")}>
                      {overdue ? `${Math.abs(daysLeft)} days overdue` : `${daysLeft} days left`}
                    </span>
                  ) : null}
                </p>
              </Link>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
