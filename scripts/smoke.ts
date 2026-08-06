import "dotenv/config";
import assert from "node:assert/strict";
import { db } from "../src/lib/db";
import { aiEnabled } from "../src/lib/ai/gemini";
import { runIntake } from "../src/features/complaints/lib/ai-intake";
import { aiMetaOf } from "../src/features/complaints/lib/ai-meta";
import { UNCLASSIFIED_WHERE } from "../src/features/complaints/queries";
import { distanceMeters } from "../src/features/complaints/lib/geo";
import { listMapPins } from "../src/features/public-site/map";
import { storyBySlug } from "../src/features/public-site/queries";
import { REPORT_TYPES, buildReport } from "../src/features/reports/queries";
import { toCsv } from "../src/lib/csv";
import { nextComplaintCode } from "../src/features/complaints/lib/code";
import { transitionComplaint } from "../src/features/complaints/lib/transition";
import { canViewComplaint } from "../src/features/complaints/lib/access";
import { canTransition } from "../src/features/complaints/lib/workflow";

/**
 * Gate check for journeys J1–J3 against the real database (`npm run smoke`). It creates
 * one complaint, walks it from draft to closed through every role, asserts the timeline
 * and the access rules at each step, and deletes it again.
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
  const [citizen, staff, dept, field] = await Promise.all([
    loadUser("u-cit1"),
    loadUser("u-staff"),
    loadUser("u-dept"), // belongs to public-works
    loadUser("u-field"),
  ]);
  const [department, otherDepartment] = await Promise.all([
    db.department.findUniqueOrThrow({ where: { slug: "public-works" } }),
    db.department.findUniqueOrThrow({ where: { slug: "water-supply" } }),
  ]);

  // ── J1: a citizen raises a concern ──
  const draft = await db.complaint.create({
    data: {
      code: `SMOKE-${Date.now()}`,
      title: "Smoke test pothole",
      description: "Created by scripts/smoke.ts — deleted before this script exits.",
      category: "ROAD",
      status: "DRAFT",
      citizenId: citizen.id,
      wardId: citizen.wardId,
      // Coordinates so the public-map assertions further down have something to place.
      latitude: 12.9716,
      longitude: 77.5946,
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

    // ── Gate M3, literally: kill the AI and the complaint still lands, unclassified ──
    process.env.AI_ENABLED = "false";
    assert.equal(aiEnabled(), false, "the kill switch actually switches it off");
    await runIntake(draft.id);

    const unclassified = await db.complaint.findFirst({
      where: { AND: [{ id: draft.id }, UNCLASSIFIED_WHERE] },
      select: { aiMeta: true, status: true },
    });
    assert.ok(unclassified, "an untagged complaint shows up in the Unclassified queue");
    assert.equal(aiMetaOf(unclassified.aiMeta)?.status, "failed");
    assert.equal(unclassified.status, "SUBMITTED", "and it is still a live complaint");
    delete process.env.AI_ENABLED;

    // ── J2: the office triages ──
    await transitionComplaint({ complaintId: draft.id, to: "ACKNOWLEDGED", actor: staff });

    // Route it to a department this officer does NOT belong to: they must not see or
    // touch it, whatever their role permissions say (gate M2).
    await transitionComplaint({
      complaintId: draft.id,
      to: "ASSIGNED",
      actor: staff,
      data: { departmentId: otherDepartment.id },
    });
    assert.equal(canViewComplaint(dept, { citizenId: citizen.id, departmentId: otherDepartment.id, assignedToId: null }), false);
    await assert.rejects(
      transitionComplaint({ complaintId: draft.id, to: "DEPT_REVIEW", actor: dept }),
      /not yours/,
      "a department officer cannot touch another department's complaint",
    );

    // Now route it where it belongs and give it to the field officer.
    await db.complaint.update({
      where: { id: draft.id },
      data: { departmentId: department.id, assignedToId: field.id },
    });
    await transitionComplaint({ complaintId: draft.id, to: "DEPT_REVIEW", actor: dept });
    assert.deepEqual(await statusOf(draft.id), { status: "DEPT_REVIEW", entries: 4 });

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

    // ── J3: the field officer works and completes ──
    // A field officer only ever sees their own assignments.
    assert.equal(
      canViewComplaint(field, {
        citizenId: citizen.id,
        departmentId: department.id,
        assignedToId: "someone-else",
      }),
      false,
      "a field officer cannot open a complaint assigned to someone else",
    );

    await transitionComplaint({ complaintId: draft.id, to: "IN_PROGRESS", actor: field });
    await transitionComplaint({ complaintId: draft.id, to: "COMPLETED", actor: field });
    assert.deepEqual(await statusOf(draft.id), { status: "COMPLETED", entries: 6 });

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
      [
        "SUBMITTED",
        "ACKNOWLEDGED",
        "ASSIGNED",
        "DEPT_REVIEW",
        "IN_PROGRESS",
        "COMPLETED",
        "CLOSED",
      ],
      "timeline records every step, in order",
    );

    // A closed complaint is the end of the line.
    await assert.rejects(
      transitionComplaint({ complaintId: draft.id, to: "REOPENED", actor: citizen }),
      /Cannot move/,
      "closed complaints are terminal",
    );

    // ── Gate M4: a closed complaint becomes a public story, with no PII attached ──
    const story = await db.impactStory.create({
      data: {
        slug: `smoke-story-${Date.now()}`,
        title: "Smoke test road repaired",
        body: "Created by scripts/smoke.ts and deleted before it exits. ".repeat(3),
        complaintId: draft.id,
        wardId: citizen.wardId,
        beforeImage: "https://example.test/before.jpg",
        afterImage: "https://example.test/after.jpg",
        publishedAt: new Date(),
      },
      select: { id: true, slug: true },
    });

    try {
      const published = await storyBySlug(story.slug);
      assert.ok(published, "a published story is readable without signing in");
      assert.equal(
        JSON.stringify(published).includes(citizen.name),
        false,
        "the story never carries the citizen's name",
      );

      const pins = await listMapPins();
      const pin = pins.find((candidate) => candidate.id === draft.id);
      assert.ok(pin, "the complaint appears on the public map");
      assert.equal(pin.storySlug, story.slug, "and links to its published story");
      assert.notEqual(pin.latitude, 12.9716, "with a jittered position, not the real one");
      assert.ok(
        distanceMeters({ latitude: 12.9716, longitude: 77.5946 }, pin) <= 55,
        "jittered, but still on the right street",
      );
    } finally {
      await db.impactStory.delete({ where: { id: story.id } });
    }

    // ── Gate M5: engagement holds its "one voice, one vote" rules; reports export ──
    const poll = await db.poll.create({
      data: {
        question: "Smoke test poll — deleted before this script exits",
        options: [
          { id: "opt-a", label: "A" },
          { id: "opt-b", label: "B" },
        ],
        startsAt: new Date(Date.now() - 3_600_000),
        endsAt: new Date(Date.now() + 3_600_000),
      },
      select: { id: true },
    });

    try {
      await db.pollVote.create({
        data: { pollId: poll.id, userId: citizen.id, optionId: "opt-a" },
      });
      await assert.rejects(
        db.pollVote.create({
          data: { pollId: poll.id, userId: citizen.id, optionId: "opt-b" },
        }),
        "one vote per user per poll is enforced by the database, not just the action",
      );
    } finally {
      await db.poll.delete({ where: { id: poll.id } }); // votes cascade
    }

    for (const type of REPORT_TYPES) {
      const report = await buildReport(type);
      assert.ok(report.headers.length > 1, `${type} report has columns`);
      assert.ok(
        report.rows.every((row) => row.length === report.headers.length),
        `${type} report rows line up with its headers`,
      );

      const csv = toCsv(report.headers, report.rows);
      assert.ok(csv.startsWith("﻿"), `${type} CSV starts with the BOM Excel needs`);
      assert.ok(csv.includes("\r\n"), `${type} CSV uses CRLF line endings`);
    }

    console.log(
      `OK — ${code} walked draft → closed through every role, 7 timeline entries,` +
        " survived the AI being switched off mid-flight, reached the public map" +
        " and stories page with no PII and a jittered pin, and all five reports" +
        " built and exported as Excel-readable CSV.",
    );
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
