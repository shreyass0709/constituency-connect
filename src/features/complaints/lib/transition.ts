import type { Prisma } from "@/generated/prisma/client";
import type { ComplaintStatus, TimelineType } from "@/generated/prisma/enums";
import type { CurrentUser } from "@/lib/auth/require-user";
import { db } from "@/lib/db";
import { ActionError } from "@/lib/safe-action";
import { STATUS_LABEL } from "@/constants/status";
import { canViewComplaint } from "./access";
import { canTransition } from "./workflow";

/**
 * Every status change in the app goes through here. One transaction: re-read the row,
 * check scope, check the workflow map, write the status *and* its timeline entry
 * together. Because the current status is re-read inside the transaction, a double-click
 * or a replayed request gets a CONFLICT rather than a second timeline entry
 * (docs/04-api.md §2 "idempotency").
 */

const SELECT = {
  id: true,
  code: true,
  title: true,
  status: true,
  citizenId: true,
  departmentId: true,
  assignedToId: true,
} satisfies Prisma.ComplaintSelect;

export async function transitionComplaint(input: {
  complaintId: string;
  to: ComplaintStatus;
  /** `null` = the nightly cron acting as the system. */
  actor: CurrentUser | null;
  note?: string | null;
  type?: TimelineType;
  /** Internal notes stay off the citizen's timeline. */
  isPublic?: boolean;
  meta?: Prisma.InputJsonValue;
  /** Extra columns written in the same transaction (assignee, ETA, rejection reason…). */
  data?: Prisma.ComplaintUncheckedUpdateInput;
}) {
  const { complaintId, to, actor } = input;

  return db.$transaction(async (tx) => {
    const complaint = await tx.complaint.findUnique({
      where: { id: complaintId },
      select: SELECT,
    });
    if (!complaint) throw new ActionError("That complaint no longer exists.");
    if (actor && !canViewComplaint(actor, complaint)) {
      throw new ActionError("That complaint is not yours to update.");
    }

    const isOwner = !!actor && complaint.citizenId === actor.id;
    const workflowActor = actor ? { role: actor.role, isOwner } : ("system" as const);
    if (!canTransition(workflowActor, complaint.status, to)) {
      throw new ActionError(
        complaint.status === to
          ? `This complaint is already ${STATUS_LABEL[to].toLowerCase()}.`
          : `Cannot move a complaint from ${STATUS_LABEL[complaint.status]} to ${STATUS_LABEL[to]}.`,
      );
    }

    const now = new Date();
    const updated = await tx.complaint.update({
      where: { id: complaintId },
      data: {
        ...input.data,
        status: to,
        ...(to === "ACKNOWLEDGED" && { acknowledgedAt: now }),
        ...(to === "COMPLETED" && { completedAt: now }),
        ...(to === "CLOSED" && { closedAt: now }),
        // A reopened complaint is live work again — clear the finish line.
        ...(to === "REOPENED" && { completedAt: null, closedAt: null }),
      },
      select: SELECT,
    });

    await tx.timelineEntry.create({
      data: {
        complaintId,
        type: input.type ?? "STATUS_CHANGE",
        actorId: actor?.id ?? null,
        fromStatus: complaint.status,
        toStatus: to,
        note: input.note ?? null,
        isPublic: input.isPublic ?? true,
        meta: input.meta,
      },
    });

    return updated;
  });
}

/** A timeline entry that records something other than a status change (comment, merge…). */
export async function addTimelineEntry(input: {
  complaintId: string;
  type: TimelineType;
  actorId?: string | null;
  note?: string | null;
  isPublic?: boolean;
  meta?: Prisma.InputJsonValue;
}) {
  return db.timelineEntry.create({
    data: {
      complaintId: input.complaintId,
      type: input.type,
      actorId: input.actorId ?? null,
      note: input.note ?? null,
      isPublic: input.isPublic ?? true,
      meta: input.meta,
    },
  });
}
