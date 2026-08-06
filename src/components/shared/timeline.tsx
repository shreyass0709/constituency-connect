import type { ComplaintStatus, TimelineType } from "@/generated/prisma/enums";
import { STATUS_CLASS, STATUS_LABEL } from "@/constants/status";
import { cn, formatDateTime } from "@/lib/utils";

export type TimelineEntryView = {
  id: string;
  type: TimelineType;
  toStatus?: ComplaintStatus | null;
  note?: string | null;
  isPublic?: boolean;
  createdAt: Date;
  actor?: { name: string } | null;
};

const TYPE_LABEL: Record<TimelineType, string> = {
  STATUS_CHANGE: "Status changed",
  ASSIGNMENT: "Assigned",
  COMMENT: "Note added",
  MEDIA_ADDED: "Photo or recording added",
  AI_ACTION: "Automatic tagging",
  FEEDBACK: "Feedback",
  ESCALATION: "Escalated",
  MERGE: "Merged with another report",
};

/** Append-only history — the citizen's trust surface (docs/05-ui.md §2). */
export function Timeline({ entries }: { entries: TimelineEntryView[] }) {
  if (entries.length === 0) {
    return <p className="text-sm text-muted-foreground">Nothing has happened yet.</p>;
  }

  return (
    <ol className="relative flex flex-col gap-6 border-l pl-6">
      {entries.map((entry) => (
        <li key={entry.id} className="relative">
          <span
            aria-hidden
            className={cn(
              "absolute -left-[1.9rem] top-1 size-3 rounded-full ring-4 ring-background",
              entry.toStatus ? STATUS_CLASS[entry.toStatus] : "bg-muted-foreground/40",
              entry.toStatus && "bg-current",
            )}
          />
          <div className="flex flex-wrap items-baseline gap-x-2">
            <span className="font-medium">
              {entry.toStatus ? STATUS_LABEL[entry.toStatus] : TYPE_LABEL[entry.type]}
            </span>
            <time className="text-xs text-muted-foreground" dateTime={new Date(entry.createdAt).toISOString()}>
              {formatDateTime(entry.createdAt)}
            </time>
            {entry.isPublic === false ? (
              <span className="rounded bg-muted px-1.5 py-0.5 text-[0.65rem] uppercase tracking-wide text-muted-foreground">
                Internal
              </span>
            ) : null}
          </div>
          {entry.note ? <p className="mt-1 text-sm text-muted-foreground">{entry.note}</p> : null}
          {entry.actor ? (
            <p className="mt-1 text-xs text-muted-foreground">by {entry.actor.name}</p>
          ) : null}
        </li>
      ))}
    </ol>
  );
}
