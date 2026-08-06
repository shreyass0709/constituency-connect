import "dotenv/config";
import assert from "node:assert/strict";
import { db } from "../src/lib/db";
import { nextComplaintCode } from "../src/features/complaints/lib/code";
import { transitionComplaint } from "../src/features/complaints/lib/transition";
import { canTransition } from "../src/features/complaints/lib/workflow";

/**
 * Phase 1 gate check: journeys J1 + J2 against the real database.
 * Run with `npx tsx scripts/smoke-phase1.ts` — it creates one complaint, walks it from
 * draft to closed, asserts the timeline at every step, and deletes it again.
 *
 * Deliberately not part of `npm test`: vitest runs in CI without a database.
 */

async function loadUser(id: string) {
  return db.user.findUniqueOrThrow({
    where: { id },
    select: {
      id: true,
      name: true,
      phone: true,
      email: true,
      image: true,
      role: true,
      language: true,
      wardId: true,
      departmentId: true,
      isActive: true,
    },
  });
}

async function statusOf(id: string) {
  const row = await db.complaint.findUniqueOrThrow({
    where: { id },
    select: { status: true, timeline: { select: { id: true } } },
  });
  return { status: row.status, entries: row.timeline.length };
}

async function main() {
  const [citizen, staff, field] = await Promise.all([
    loadUser("u-cit1"),
    loadUser("u-staff"),
    loadUser("u-field"),
  ]);
  const department = await db.department.findUniqueOrThrow({ where: { slug: "public-works" } });

  // ── J1: a citizen raises a concern ──
  const draft = await db.complaint.create({
    data: {
      code: `SMOKE-${Date.now()}`,
      title: "Smoke test pothole",
      description: "Created by scripts/smoke-phase1.ts — deleted before this script exits.",
      category: "ROAD",
      status: "DRAFT",
      citizenId: citizen.id,
      wardId: citizen.wardId,
    },
    select: { id: true },
  });

  try {
    const code = await nextComplaintCode(db);
    assert.match(code, /^CC-\d{4}-\d{5}$/, "complaint code shape");

    // Nobody but the owner may submit a draft.
    assert.equal(canTransition({ role: "OFFICE_STAFF" }, "DRAFT", "SUBMITTED"), false);
    await assert.rejects(
      transitionComplaint({ complaintId: draft.id, to: "SUBMITTED", actor: staff }),
      /Cannot move/,
      "staff cannot submit someone else's draft",
    );

    await transitionComplaint({
      complaintId: draft.id,
      to: "SUBMITTED",
      actor: citizen,
      note: "Concern submitted",
      data: { code, dueAt: new Date(Date.now() + 7 * 86_400_000) },
    });
    assert.deepEqual(await statusOf(draft.id), { status: "SUBMITTED", entries: 1 });

    // Replaying the same transition is a conflict, not a second timeline entry.
    await assert.rejects(
      transitionComplaint({ complaintId: draft.id, to: "SUBMITTED", actor: citizen }),
      /already/,
      "re-submitting is idempotent",
    );
    assert.equal((await statusOf(draft.id)).entries, 1);

    // ── J2: the office triages ──
    await transitionComplaint({ complaintId: draft.id, to: "ACKNOWLEDGED", actor: staff });
    await transitionComplaint({
      complaintId: draft.id,
      to: "ASSIGNED",
      actor: staff,
      data: { departmentId: department.id, assignedToId: field.id },
    });
    assert.deepEqual(await statusOf(draft.id), { status: "ASSIGNED", entries: 3 });

    const acknowledged = await db.complaint.findUniqueOrThrow({
      where: { id: draft.id },
      select: { acknowledgedAt: true },
    });
    assert.ok(acknowledged.acknowledgedAt, "acknowledgedAt is stamped");

    // Triage cannot do field work, and the field cannot skip to closed.
    await assert.rejects(
      transitionComplaint({ complaintId: draft.id, to: "COMPLETED", actor: staff }),
      /Cannot move/,
      "office staff cannot complete work",
    );

    // ── J1 continued: the field officer works and completes ──
    await transitionComplaint({ complaintId: draft.id, to: "IN_PROGRESS", actor: field });
    await transitionComplaint({ complaintId: draft.id, to: "COMPLETED", actor: field });
    assert.deepEqual(await statusOf(draft.id), { status: "COMPLETED", entries: 5 });

    // Only the citizen (or the nightly cron) may close it.
    await assert.rejects(
      transitionComplaint({ complaintId: draft.id, to: "CLOSED", actor: staff }),
      /Cannot move/,
      "staff cannot confirm on the citizen's behalf",
    );

    await transitionComplaint({
      complaintId: draft.id,
      to: "CLOSED",
      actor: citizen,
      note: "Citizen confirmed the work is done",
    });
    const closed = await db.complaint.findUniqueOrThrow({
      where: { id: draft.id },
      select: { status: true, closedAt: true, timeline: { select: { toStatus: true } } },
    });
    assert.equal(closed.status, "CLOSED");
    assert.ok(closed.closedAt, "closedAt is stamped");
    assert.deepEqual(
      closed.timeline.map((entry) => entry.toStatus),
      ["SUBMITTED", "ACKNOWLEDGED", "ASSIGNED", "IN_PROGRESS", "COMPLETED", "CLOSED"],
      "timeline records every step, in order",
    );

    // A closed complaint is the end of the line.
    await assert.rejects(
      transitionComplaint({ complaintId: draft.id, to: "REOPENED", actor: citizen }),
      /Cannot move/,
      "closed complaints are terminal",
    );

    console.log(`OK — ${code} walked draft → closed with 6 timeline entries.`);
  } finally {
    await db.complaint.delete({ where: { id: draft.id } });
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
