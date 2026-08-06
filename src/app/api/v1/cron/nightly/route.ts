import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { notifyComplaint, notifyUsers } from "@/lib/notify";
import { addTimelineEntry, transitionComplaint } from "@/features/complaints/lib/transition";
import { recomputeActionStats } from "@/features/public-site/lib/action-stats";

/** The marker that stops one overdue complaint being flagged again every single night. */
const SLA_BREACH_NOTE = "Past its resolution target";
const CONFIRM_WINDOW_DAYS = 7;

function authorized(request: Request): boolean {
  if (!env.CRON_SECRET) return false; // no secret configured ⇒ nobody may run it
  const header = request.headers.get("authorization");
  return (
    header === `Bearer ${env.CRON_SECRET}` || // how Vercel Cron sends it
    request.headers.get("x-cron-secret") === env.CRON_SECRET // how a human curls it
  );
}

/**
 * Nightly housekeeping (docs/02-architecture.md §7):
 *  1. close complaints the citizen never responded to inside the 7-day window;
 *  2. flag complaints that have blown their SLA, once each.
 */
export async function GET(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json(
      { error: { code: "FORBIDDEN", message: "Not for you." } },
      { status: 403 },
    );
  }

  const cutoff = new Date(Date.now() - CONFIRM_WINDOW_DAYS * 24 * 60 * 60 * 1000);

  const toClose = await db.complaint.findMany({
    where: { status: "COMPLETED", completedAt: { lt: cutoff } },
    select: { id: true, code: true },
  });

  let closed = 0;
  for (const complaint of toClose) {
    try {
      await transitionComplaint({
        complaintId: complaint.id,
        to: "CLOSED",
        actor: null, // the system is the only non-owner allowed to close
        note: `Closed automatically — no response within ${CONFIRM_WINDOW_DAYS} days of completion`,
      });
      closed += 1;
      await notifyComplaint(complaint.id, {
        type: "complaint.auto_closed",
        title: `Closed — ${complaint.code}`,
        body: "We heard nothing back, so this is now closed. Reopen it any time if the problem returns.",
      });
    } catch (error) {
      console.error("[cron] auto-close failed", complaint.code, error);
    }
  }

  const breached = await db.complaint.findMany({
    where: {
      dueAt: { lt: new Date() },
      status: { notIn: ["DRAFT", "COMPLETED", "CLOSED", "REJECTED"] },
      timeline: { none: { type: "ESCALATION", note: SLA_BREACH_NOTE } },
    },
    select: { id: true, code: true, title: true, dueAt: true, assignedToId: true },
  });

  if (breached.length > 0) {
    const admins = await db.user.findMany({
      where: { role: { in: ["ADMIN", "SUPER_ADMIN", "OFFICE_STAFF"] }, isActive: true },
      select: { id: true },
    });

    for (const complaint of breached) {
      await addTimelineEntry({
        complaintId: complaint.id,
        type: "ESCALATION",
        note: SLA_BREACH_NOTE,
        isPublic: false,
      });
      await notifyUsers(
        [...admins.map((admin) => admin.id), complaint.assignedToId].filter(
          (id): id is string => !!id,
        ),
        {
          type: "complaint.sla_breached",
          title: `Past SLA — ${complaint.code}`,
          body: complaint.title,
          link: `/office/complaints/${complaint.id}`,
        },
      );
    }
  }

  // The public Action Dashboard's automatic counters are recalculated last, so they
  // include tonight's auto-closures.
  const stats = await recomputeActionStats();

  return NextResponse.json({
    data: { closed, breached: breached.length, statsUpdated: stats.updated },
  });
}
