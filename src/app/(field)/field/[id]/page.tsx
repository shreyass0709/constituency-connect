import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { ChevronLeft, MapPin, Navigation } from "lucide-react";
import { PriorityBadge, StatusChip } from "@/components/shared/status-chip";
import { Timeline } from "@/components/shared/timeline";
import { CATEGORY_LABEL, STATUS_HINT } from "@/constants/status";
import { requireUser } from "@/lib/auth/require-user";
import { formatDate } from "@/lib/utils";
import { getComplaintForViewer } from "@/features/complaints/queries";
import { TaskActions } from "@/features/field/task-actions";

export const metadata = { title: "Task" };

/** Mobile-first by default: one column, big targets, no sidebar chrome to fight. */
export default async function FieldTaskPage({ params }: PageProps<"/field/[id]">) {
  const user = await requireUser("complaint.field_update");
  const { id } = await params;

  const complaint = await getComplaintForViewer(id, user);
  if (!complaint) notFound();

  const proof = complaint.media.filter(
    (item) => item.kind !== "AUDIO" && item.stage !== "SIGNATURE" && item.stage !== "SUBMISSION",
  );
  const reported = complaint.media.filter((item) => item.stage === "SUBMISSION");

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <Link
        href="/field"
        className="inline-flex w-fit items-center gap-1 text-sm text-muted-foreground"
      >
        <ChevronLeft className="size-4" aria-hidden />
        All tasks
      </Link>

      <header className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-xs text-muted-foreground">{complaint.code}</span>
          <StatusChip status={complaint.status} />
          <PriorityBadge priority={complaint.priority} />
        </div>
        <h1 className="font-heading text-xl font-semibold tracking-tight">{complaint.title}</h1>
        <p className="text-sm text-muted-foreground">{STATUS_HINT[complaint.status]}</p>
      </header>

      <div className="flex flex-col gap-2 rounded-2xl border p-4 text-sm">
        <p className="whitespace-pre-wrap">{complaint.description}</p>
        <p className="text-muted-foreground">
          {CATEGORY_LABEL[complaint.category]}
          {complaint.ward ? ` · ${complaint.ward.name}` : ""}
          {complaint.estimatedCompletion
            ? ` · due ${formatDate(complaint.estimatedCompletion)}`
            : ""}
        </p>
        {complaint.address || complaint.landmark ? (
          <p className="flex items-start gap-2 text-muted-foreground">
            <MapPin className="mt-0.5 size-4 shrink-0" aria-hidden />
            {[complaint.address, complaint.landmark].filter(Boolean).join(" · ")}
          </p>
        ) : null}
        {complaint.latitude && complaint.longitude ? (
          <a
            href={`https://www.openstreetmap.org/directions?to=${complaint.latitude},${complaint.longitude}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex w-fit items-center gap-2 rounded-lg border px-3 py-1.5 font-medium"
          >
            <Navigation className="size-4" aria-hidden />
            Navigate there
          </a>
        ) : null}
      </div>

      {reported.length > 0 ? (
        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-medium text-muted-foreground">What the citizen sent</h2>
          <ul className="flex flex-wrap gap-2">
            {reported.map((item) => (
              <li key={item.id}>
                <a href={item.url} target="_blank" rel="noreferrer">
                  {item.kind === "IMAGE" ? (
                    <Image
                      src={item.url}
                      alt=""
                      width={96}
                      height={96}
                      className="size-24 rounded-xl border object-cover"
                    />
                  ) : (
                    <span className="flex size-24 items-center justify-center rounded-xl border text-xs text-muted-foreground">
                      {item.kind === "AUDIO" ? "Voice note" : "Video"}
                    </span>
                  )}
                </a>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <TaskActions
        complaintId={complaint.id}
        status={complaint.status}
        proof={proof.map((item) => ({ id: item.id, url: item.url }))}
      />

      <section className="flex flex-col gap-3">
        <h2 className="font-heading text-lg font-semibold">History</h2>
        <Timeline entries={complaint.timeline} />
      </section>
    </div>
  );
}
