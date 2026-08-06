import Image from "next/image";
import { CircleCheckBig, MapPin, Play, Star } from "lucide-react";
import { PriorityBadge, StatusChip } from "@/components/shared/status-chip";
import { Timeline } from "@/components/shared/timeline";
import { CATEGORY_LABEL, STATUS_HINT } from "@/constants/status";
import { can } from "@/lib/auth/permissions";
import type { CurrentUser } from "@/lib/auth/require-user";
import { cn, daysBetween, formatDate } from "@/lib/utils";
import { ComplaintActions } from "./complaint-actions";
import { CopyCode } from "./copy-code";
import { nextStatuses } from "./lib/workflow";
import type { ComplaintDetail as ComplaintDetailData } from "./queries";

/** The trust surface (docs/05-ui.md §2) — same component for citizen, office and officer. */
export function ComplaintDetail({
  complaint,
  viewer,
  departments,
  officers,
  justSubmitted,
}: {
  complaint: ComplaintDetailData;
  viewer: CurrentUser;
  departments: { id: string; name: string }[];
  officers: { id: string; name: string; departmentId: string | null }[];
  justSubmitted?: boolean;
}) {
  const isOwner = complaint.citizenId === viewer.id;
  const canTriage = can(viewer.role, "complaint.triage");
  const allowed = nextStatuses({ role: viewer.role, isOwner }, complaint.status);
  const daysLeft = complaint.dueAt ? daysBetween(new Date(), complaint.dueAt) : null;

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      {justSubmitted ? (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-primary/30 bg-primary/5 p-6 text-center">
          <CircleCheckBig className="size-8 text-primary" aria-hidden />
          <h2 className="text-lg font-semibold">We have your concern</h2>
          <CopyCode code={complaint.code} />
          <p className="max-w-md text-sm text-muted-foreground">
            Keep this code. The office reviews it, assigns a department, and you get a
            notification at every step — no need to follow up.
          </p>
        </div>
      ) : null}

      <header className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-sm text-muted-foreground">{complaint.code}</span>
          <StatusChip status={complaint.status} />
          <PriorityBadge priority={complaint.priority} />
          {complaint.isPrivate ? (
            <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs">Private</span>
          ) : null}
        </div>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">{complaint.title}</h1>
        <p className="text-muted-foreground">{STATUS_HINT[complaint.status]}</p>
      </header>

      <dl className="grid gap-4 rounded-2xl border p-4 text-sm sm:grid-cols-2">
        <Field label="Category" value={CATEGORY_LABEL[complaint.category]} />
        <Field label="Ward" value={complaint.ward?.name ?? "Not set"} />
        <Field label="Department" value={complaint.department?.name ?? "Not routed yet"} />
        <Field label="Officer" value={complaint.assignedTo?.name ?? "Not assigned yet"} />
        <Field label="Raised" value={formatDate(complaint.createdAt)} />
        <Field
          label="Estimated completion"
          value={complaint.estimatedCompletion ? formatDate(complaint.estimatedCompletion) : "—"}
        />
        {complaint.dueAt ? (
          <Field
            label="Resolution target"
            value={
              complaint.completedAt || complaint.closedAt
                ? formatDate(complaint.dueAt)
                : daysLeft !== null && daysLeft < 0
                  ? `${Math.abs(daysLeft)} days overdue`
                  : `${daysLeft} days left (by ${formatDate(complaint.dueAt)})`
            }
            className={cn(
              daysLeft !== null && daysLeft < 0 && !complaint.completedAt && "text-red-600 dark:text-red-300",
            )}
          />
        ) : null}
        {canTriage ? (
          <Field label="Raised by" value={`${complaint.citizen.name} · ${complaint.citizen.phone ?? "no phone"}`} />
        ) : null}
      </dl>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-medium text-muted-foreground">What was reported</h2>
        <p className="whitespace-pre-wrap">{complaint.description}</p>
        {complaint.address || complaint.landmark ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <MapPin className="size-4" aria-hidden />
            {[complaint.address, complaint.landmark].filter(Boolean).join(" · ")}
          </p>
        ) : null}
        {complaint.latitude && complaint.longitude ? (
          <a
            className="w-fit text-sm text-primary underline-offset-4 hover:underline"
            href={`https://www.openstreetmap.org/?mlat=${complaint.latitude}&mlon=${complaint.longitude}#map=18/${complaint.latitude}/${complaint.longitude}`}
            target="_blank"
            rel="noreferrer"
          >
            Open the location on a map
          </a>
        ) : null}
      </section>

      {complaint.rejectionReason ? (
        <p className="rounded-2xl border border-red-500/30 bg-red-500/5 p-4 text-sm">
          <strong className="font-medium">Reason: </strong>
          {complaint.rejectionReason}
          {complaint.duplicateOf ? (
            <>
              {" "}
              Follow{" "}
              <span className="font-mono">{complaint.duplicateOf.code}</span> for updates.
            </>
          ) : null}
        </p>
      ) : null}

      {complaint.media.length > 0 ? (
        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-medium text-muted-foreground">Attachments</h2>
          <ul className="flex flex-wrap gap-3">
            {complaint.media.map((item) => (
              <li key={item.id}>
                {item.kind === "IMAGE" ? (
                  <a href={item.url} target="_blank" rel="noreferrer">
                    <Image
                      src={item.url}
                      alt=""
                      width={128}
                      height={128}
                      className="size-32 rounded-xl border object-cover"
                    />
                  </a>
                ) : (
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noreferrer"
                    className="flex size-32 flex-col items-center justify-center gap-1 rounded-xl border text-xs text-muted-foreground"
                  >
                    <Play className="size-5" aria-hidden />
                    {item.kind === "AUDIO" ? "Voice note" : "Video"}
                  </a>
                )}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {complaint.rating ? (
        <p className="flex items-center gap-2 rounded-2xl border p-4 text-sm">
          <Star className="size-4 fill-amber-400 text-amber-400" aria-hidden />
          <span className="font-medium">{complaint.rating}/5</span>
          {complaint.feedbackText ? (
            <span className="text-muted-foreground">— {complaint.feedbackText}</span>
          ) : null}
        </p>
      ) : null}

      <ComplaintActions
        id={complaint.id}
        status={complaint.status}
        category={complaint.category}
        priority={complaint.priority}
        departmentId={complaint.departmentId}
        isOwner={isOwner}
        canTriage={canTriage}
        hasRating={complaint.rating !== null}
        allowed={allowed}
        departments={departments}
        officers={officers}
      />

      <section className="flex flex-col gap-4">
        <h2 className="font-heading text-lg font-semibold">History</h2>
        <Timeline entries={complaint.timeline} />
      </section>
    </div>
  );
}

function Field({
  label,
  value,
  className,
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div className="grid gap-0.5">
      <dt className="text-xs uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className={cn("font-medium", className)}>{value}</dd>
    </div>
  );
}
