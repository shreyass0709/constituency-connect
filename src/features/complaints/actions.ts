"use server";

import { after } from "next/server";
import { randomUUID } from "node:crypto";
import { MEDIA_RULES, destroyAsset, inspectAsset } from "@/lib/cloudinary";
import { env } from "@/lib/env";
import { db } from "@/lib/db";
import { notifyComplaint, notifyUsers } from "@/lib/notify";
import { ActionError, defineAction } from "@/lib/safe-action";
import { STATUS_LABEL } from "@/constants/status";
import { canViewComplaint } from "./lib/access";
import { runIntake } from "./lib/ai-intake";
import { nextComplaintCode } from "./lib/code";
import { distanceMeters, GEO_PROOF_RADIUS_M, resolveWardId } from "./lib/geo";
import { addTimelineEntry, transitionComplaint } from "./lib/transition";
import {
  assignSchema,
  attachMediaSchema,
  categorizeSchema,
  complaintIdSchema,
  completeWorkSchema,
  escalateSchema,
  feedbackSchema,
  mergeSchema,
  rejectSchema,
  removeMediaSchema,
  reopenSchema,
  saveDraftSchema,
  submitComplaintSchema,
  submittableSchema,
  workNoteSchema,
} from "./schemas";
import { z } from "zod";

// ── Citizen: draft → submit ─────────────────────────────────────────────────

/**
 * Called at every step of the raise wizard. The draft *is* the complaint row (status
 * DRAFT) so media can hang off it before submission; it gets its real `CC-…` code only
 * when the citizen actually sends it.
 */
export const saveDraft = defineAction({
  name: "complaint.save_draft",
  entity: "complaint",
  schema: saveDraftSchema,
  permission: "complaint.create",
  handler: async ({ id, ...fields }, { user }) => {
    if (id) {
      const existing = await db.complaint.findUnique({
        where: { id },
        select: { citizenId: true, status: true },
      });
      if (!existing || existing.citizenId !== user.id) throw new ActionError("Draft not found.");
      if (existing.status !== "DRAFT") throw new ActionError("This concern was already submitted.");
      return db.complaint.update({ where: { id }, data: fields, select: { id: true } });
    }

    return db.complaint.create({
      data: {
        ...fields,
        title: fields.title ?? "",
        description: fields.description ?? "",
        // Placeholder until submit draws a real number from the sequence — `code` is
        // NOT NULL and unique, and an unsent draft has no place in the public numbering.
        code: `DRAFT-${randomUUID()}`,
        citizenId: user.id,
        status: "DRAFT",
      },
      select: { id: true },
    });
  },
});

export const discardDraft = defineAction({
  name: "complaint.discard_draft",
  entity: "complaint",
  schema: complaintIdSchema,
  permission: "complaint.create",
  handler: async ({ id }, { user }) => {
    const draft = await db.complaint.findUnique({
      where: { id },
      select: { citizenId: true, status: true },
    });
    if (!draft || draft.citizenId !== user.id) throw new ActionError("Draft not found.");
    if (draft.status !== "DRAFT") throw new ActionError("Submitted concerns cannot be deleted.");
    await db.complaint.delete({ where: { id } });
    return { id };
  },
});

export const submitComplaint = defineAction({
  name: "complaint.submit",
  entity: "complaint",
  schema: submitComplaintSchema,
  permission: "complaint.create",
  // 5 a day per citizen (docs/02 §8) — enough for a genuinely bad week, not enough to
  // flood triage. Drafts are unlimited; only submitting counts.
  limit: {
    max: 5,
    windowMs: 86_400_000,
    message: "You have raised five concerns today. Please continue tomorrow, or call the office.",
  },
  handler: async ({ id }, { user }) => {
    const draft = await db.complaint.findUnique({
      where: { id },
      select: {
        citizenId: true,
        status: true,
        title: true,
        description: true,
        category: true,
        latitude: true,
        longitude: true,
      },
    });
    if (!draft || draft.citizenId !== user.id) throw new ActionError("Draft not found.");
    if (draft.status !== "DRAFT") throw new ActionError("This concern was already submitted.");

    const complete = submittableSchema.safeParse(draft);
    if (!complete.success) {
      throw new ActionError(z.prettifyError(complete.error).replace(/^✖ /gm, ""));
    }

    // Ward comes from the pin when boundaries are drawn, else from the citizen's own ward.
    const wards = await db.ward.findMany({ select: { id: true, boundary: true } });
    const wardId = resolveWardId(wards, draft, user.wardId);

    // SLA clock starts at submission (docs/01 FR-3).
    const sla = await db.slaPolicy.findUnique({ where: { category: complete.data.category } });
    const dueAt = sla
      ? new Date(Date.now() + sla.resolveDays * 24 * 60 * 60 * 1000)
      : null;

    const code = await nextComplaintCode(db);
    const complaint = await transitionComplaint({
      complaintId: id,
      to: "SUBMITTED",
      actor: user,
      note: "Concern submitted",
      data: { code, wardId, dueAt },
    });

    after(async () => {
      await notifyComplaint(complaint.id, {
        type: "complaint.submitted",
        title: `Received — ${complaint.code}`,
        body: "Your concern is with the office. We'll tell you the moment it moves.",
      });
      // Tagging and duplicate detection run after the citizen already has their code —
      // and land the complaint in Unclassified if anything about them goes wrong.
      await runIntake(complaint.id);
    });

    return { id: complaint.id, code: complaint.code };
  },
});

// ── Media ───────────────────────────────────────────────────────────────────

export const attachMedia = defineAction({
  name: "complaint.attach_media",
  entity: "media",
  schema: attachMediaSchema,
  permission: "complaint.create",
  handler: async ({ complaintId, stage, ...file }, { user }) => {
    const complaint = await db.complaint.findUnique({
      where: { id: complaintId },
      select: {
        citizenId: true,
        departmentId: true,
        assignedToId: true,
        status: true,
        latitude: true,
        longitude: true,
      },
    });
    if (!complaint || !canViewComplaint(user, complaint)) {
      throw new ActionError("That complaint is not yours to add to.");
    }

    const rule = MEDIA_RULES[file.kind];
    const tooLarge = new ActionError(
      `That file is too large — the limit is ${Math.round(rule.maxBytes / 1024 / 1024)} MB.`,
    );
    if (!file.publicId.startsWith(`${rule.folder}/`)) {
      throw new ActionError("That file did not come from our media store.");
    }

    // The browser's size and URL are claims; Cloudinary's record of the asset is the fact.
    // If Cloudinary cannot be asked we fall back to the claim rather than block a complaint.
    const asset = await inspectAsset(file.kind, file.publicId);
    if (asset === "missing") throw new ActionError("That upload could not be found. Try again.");
    if (asset === "unknown") {
      if (file.sizeBytes && file.sizeBytes > rule.maxBytes) throw tooLarge;
    } else {
      if (asset.bytes > rule.maxBytes) {
        await destroyAsset(file.kind, file.publicId);
        throw tooLarge;
      }
      file.url = asset.url;
      file.sizeBytes = asset.bytes;
    }

    // The browser reports where Cloudinary put the file, so it can report anything. Only
    // a delivery URL in our own cloud is believable (docs/07 row 6).
    if (!file.url.startsWith(`https://res.cloudinary.com/${env.CLOUDINARY_CLOUD_NAME}/`)) {
      throw new ActionError("That file did not come from our media store.");
    }

    // Geo-verification: how far from the reported spot was this actually taken? We warn,
    // we never block — GPS drifts, buildings block the sky, and the work still happened
    // (docs/01 FR-5).
    const distance =
      typeof file.latitude === "number" &&
      typeof file.longitude === "number" &&
      typeof complaint.latitude === "number" &&
      typeof complaint.longitude === "number"
        ? distanceMeters(
            { latitude: file.latitude, longitude: file.longitude },
            { latitude: complaint.latitude, longitude: complaint.longitude },
          )
        : null;

    const media = await db.media.create({
      data: {
        ...file,
        complaintId,
        uploadedById: user.id,
        capturedAt: new Date(),
        stage: stage ?? (complaint.status === "DRAFT" ? "SUBMISSION" : "PROGRESS"),
      },
      select: { id: true, url: true, kind: true },
    });

    if (complaint.status !== "DRAFT" && stage !== "SIGNATURE") {
      await addTimelineEntry({
        complaintId,
        type: "MEDIA_ADDED",
        actorId: user.id,
        note:
          distance === null
            ? "Added a photo or recording"
            : distance <= GEO_PROOF_RADIUS_M
              ? `Added on-site proof (${distance} m from the reported spot)`
              : `Added proof taken ${distance} m from the reported spot`,
        meta: distance === null ? undefined : { distanceMeters: distance },
      });
    }

    return { ...media, distanceMeters: distance, offSite: distance !== null && distance > GEO_PROOF_RADIUS_M };
  },
});

export const removeMedia = defineAction({
  name: "complaint.remove_media",
  entity: "media",
  schema: removeMediaSchema,
  permission: "complaint.create",
  handler: async ({ id }, { user }) => {
    const media = await db.media.findUnique({
      where: { id },
      select: { uploadedById: true, complaint: { select: { status: true } } },
    });
    if (!media || media.uploadedById !== user.id) throw new ActionError("File not found.");
    if (media.complaint && media.complaint.status !== "DRAFT") {
      throw new ActionError("Files on a submitted concern are part of its record.");
    }
    // ponytail: the Cloudinary asset is left behind. A weekly orphan sweep can reclaim
    // it later — deleting remotely on every click buys nothing and can fail loudly.
    await db.media.delete({ where: { id } });
    return { id };
  },
});

// ── Field officer ───────────────────────────────────────────────────────────

/** A progress note from site. Public: the citizen should see the work happening. */
export const addWorkNote = defineAction({
  name: "complaint.work_note",
  entity: "complaint",
  schema: workNoteSchema,
  permission: "complaint.view_all",
  handler: async ({ id, note }, { user }) => {
    const complaint = await db.complaint.findUnique({
      where: { id },
      select: { id: true, code: true, citizenId: true, departmentId: true, assignedToId: true },
    });
    if (!complaint || !canViewComplaint(user, complaint)) {
      throw new ActionError("That complaint is not yours to update.");
    }

    await addTimelineEntry({ complaintId: id, type: "COMMENT", actorId: user.id, note });

    after(async () => {
      await notifyComplaint(
        id,
        { type: "complaint.work_note", title: `Update — ${complaint.code}`, body: note },
        { exceptUserId: user.id },
      );
    });

    return { id };
  },
});

/**
 * The end of J3: work is done, here is the proof. A completion with no photo is the one
 * thing this refuses — the after-picture is what makes the outcome visible.
 */
export const completeWork = defineAction({
  name: "complaint.complete",
  entity: "complaint",
  schema: completeWorkSchema,
  permission: "complaint.field_update",
  handler: async ({ id, note, signatureMediaId }, { user }) => {
    const proof = await db.media.count({
      where: {
        complaintId: id,
        uploadedById: user.id,
        kind: { in: ["IMAGE", "VIDEO"] },
        stage: { in: ["PROGRESS", "VERIFICATION", "RESOLUTION"] },
      },
    });
    if (proof === 0) {
      throw new ActionError("Add at least one photo of the finished work before completing.");
    }

    if (signatureMediaId) {
      const signature = await db.media.findUnique({
        where: { id: signatureMediaId },
        select: { complaintId: true },
      });
      if (!signature || signature.complaintId !== id) {
        throw new ActionError("That signature does not belong to this complaint.");
      }
      await db.media.update({ where: { id: signatureMediaId }, data: { stage: "SIGNATURE" } });
    }

    const complaint = await transitionComplaint({
      complaintId: id,
      to: "COMPLETED",
      actor: user,
      note: note || "Work completed on site",
      meta: { signed: Boolean(signatureMediaId) },
    });

    after(async () => {
      await notifyComplaint(
        complaint.id,
        {
          type: "complaint.status_changed",
          title: `Work done — ${complaint.code}`,
          body: "Please check it and confirm, or reopen within 7 days if it is not right.",
        },
        { exceptUserId: user.id },
      );
    });

    return { id: complaint.id };
  },
});

// ── Citizen: closing the loop ───────────────────────────────────────────────

export const confirmResolution = defineAction({
  name: "complaint.confirm",
  entity: "complaint",
  schema: complaintIdSchema,
  permission: "complaint.create",
  handler: async ({ id }, { user }) => {
    const complaint = await transitionComplaint({
      complaintId: id,
      to: "CLOSED",
      actor: user,
      note: "Citizen confirmed the work is done",
    });
    after(async () => {
      await notifyComplaint(
        complaint.id,
        {
          type: "complaint.closed",
          title: `Closed — ${complaint.code}`,
          body: "Thank you for confirming. Please rate how it went.",
        },
        { exceptUserId: user.id },
      );
    });
    return { id: complaint.id };
  },
});

export const reopenComplaint = defineAction({
  name: "complaint.reopen",
  entity: "complaint",
  schema: reopenSchema,
  permission: "complaint.create",
  handler: async ({ id, reason }, { user }) => {
    const complaint = await transitionComplaint({
      complaintId: id,
      to: "REOPENED",
      actor: user,
      note: reason,
    });
    after(async () => {
      await notifyComplaint(
        complaint.id,
        {
          type: "complaint.reopened",
          title: `Reopened — ${complaint.code}`,
          body: reason,
        },
        { exceptUserId: user.id },
      );
    });
    return { id: complaint.id };
  },
});

export const submitFeedback = defineAction({
  name: "complaint.feedback",
  entity: "complaint",
  schema: feedbackSchema,
  permission: "complaint.create",
  handler: async ({ id, rating, feedbackText }, { user }) => {
    const complaint = await db.complaint.findUnique({
      where: { id },
      select: { citizenId: true, status: true, rating: true },
    });
    if (!complaint || complaint.citizenId !== user.id) throw new ActionError("Complaint not found.");
    if (complaint.status !== "CLOSED") {
      throw new ActionError("You can rate a concern once it is closed.");
    }
    if (complaint.rating !== null) throw new ActionError("You have already rated this concern.");

    await db.complaint.update({ where: { id }, data: { rating, feedbackText } });
    await addTimelineEntry({
      complaintId: id,
      type: "FEEDBACK",
      actorId: user.id,
      note: `Rated ${rating}/5${feedbackText ? ` — ${feedbackText}` : ""}`,
    });
    return { id };
  },
});

export const followComplaint = defineAction({
  name: "complaint.follow",
  entity: "complaint",
  schema: complaintIdSchema,
  permission: "complaint.create",
  handler: async ({ id }, { user }) => {
    const complaint = await db.complaint.findUnique({
      where: { id },
      select: { id: true, isPrivate: true },
    });
    if (!complaint || complaint.isPrivate) throw new ActionError("Complaint not found.");
    await db.complaintFollower.upsert({
      where: { complaintId_userId: { complaintId: id, userId: user.id } },
      create: { complaintId: id, userId: user.id },
      update: {},
    });
    return { id };
  },
});

// ── Office triage ───────────────────────────────────────────────────────────

export const acknowledgeComplaint = defineAction({
  name: "complaint.acknowledge",
  entity: "complaint",
  schema: complaintIdSchema,
  permission: "complaint.triage",
  handler: async ({ id }, { user }) => {
    const complaint = await transitionComplaint({
      complaintId: id,
      to: "ACKNOWLEDGED",
      actor: user,
      note: "The office has seen your concern",
    });
    after(async () => {
      await notifyComplaint(
        complaint.id,
        {
          type: "complaint.status_changed",
          title: `Acknowledged — ${complaint.code}`,
          body: "The office has read your concern and is deciding who handles it.",
        },
        { exceptUserId: user.id },
      );
    });
    return { id: complaint.id };
  },
});

/** Accept or override the suggested category/priority/department. No status change. */
export const categorizeComplaint = defineAction({
  name: "complaint.categorize",
  entity: "complaint",
  schema: categorizeSchema,
  permission: "complaint.triage",
  handler: async ({ id, category, priority, departmentId }, { user }) => {
    const complaint = await db.complaint.findUnique({
      where: { id },
      select: { status: true, category: true, priority: true },
    });
    if (!complaint) throw new ActionError("Complaint not found.");
    if (complaint.status === "DRAFT") throw new ActionError("That concern is still a draft.");

    // The resolve clock is set by category, so re-categorising moves the deadline.
    const sla = await db.slaPolicy.findUnique({ where: { category } });
    await db.complaint.update({
      where: { id },
      data: {
        category,
        priority,
        departmentId: departmentId ?? undefined,
        ...(sla && { dueAt: new Date(Date.now() + sla.resolveDays * 24 * 60 * 60 * 1000) }),
      },
    });
    await addTimelineEntry({
      complaintId: id,
      type: "COMMENT",
      actorId: user.id,
      isPublic: false,
      note: `Categorised as ${category} · ${priority} priority`,
    });
    return { id };
  },
});

/** One action for a single row and for the bulk bar — the tx is the same either way. */
export const assignComplaints = defineAction({
  name: "complaint.assign",
  entity: "complaint",
  schema: assignSchema,
  permission: "complaint.triage",
  handler: async ({ ids, departmentId, officerId, estimatedCompletion }, { user }) => {
    const department = await db.department.findUnique({
      where: { id: departmentId },
      select: { id: true, name: true },
    });
    if (!department) throw new ActionError("That department no longer exists.");

    if (officerId) {
      const officer = await db.user.findUnique({
        where: { id: officerId },
        select: { departmentId: true, isActive: true },
      });
      if (!officer?.isActive) throw new ActionError("That officer's account is not active.");
      if (officer.departmentId !== departmentId) {
        throw new ActionError("That officer does not belong to the chosen department.");
      }
    }

    const assigned: { id: string; code: string }[] = [];
    const skipped: string[] = [];
    for (const id of ids) {
      try {
        const complaint = await transitionComplaint({
          complaintId: id,
          to: "ASSIGNED",
          actor: user,
          note: `Assigned to ${department.name}`,
          data: { departmentId, assignedToId: officerId ?? null, estimatedCompletion },
        });
        assigned.push({ id: complaint.id, code: complaint.code });
      } catch (error) {
        // A bulk assign must not lose the other 49 rows because one moved underneath us.
        if (error instanceof ActionError) skipped.push(id);
        else throw error;
      }
    }
    if (assigned.length === 0) throw new ActionError("None of those could be assigned.");

    after(async () => {
      for (const complaint of assigned) {
        await notifyComplaint(
          complaint.id,
          {
            type: "complaint.assigned",
            title: `Assigned — ${complaint.code}`,
            body: `Now with ${department.name}${estimatedCompletion ? `, estimated by ${estimatedCompletion.toLocaleDateString()}` : ""}.`,
          },
          { exceptUserId: user.id, alsoNotify: [officerId] },
        );
      }
    });

    return { assigned: assigned.length, skipped };
  },
});

export const rejectComplaint = defineAction({
  name: "complaint.reject",
  entity: "complaint",
  schema: rejectSchema,
  permission: "complaint.triage",
  handler: async ({ id, reason }, { user }) => {
    const complaint = await transitionComplaint({
      complaintId: id,
      to: "REJECTED",
      actor: user,
      note: reason,
      data: { rejectionReason: reason },
    });
    after(async () => {
      await notifyComplaint(
        complaint.id,
        {
          type: "complaint.rejected",
          title: `Closed without action — ${complaint.code}`,
          body: reason,
        },
        { exceptUserId: user.id },
      );
    });
    return { id: complaint.id };
  },
});

/** The duplicate is rejected and its reporter starts following the original instead. */
export const mergeDuplicate = defineAction({
  name: "complaint.merge",
  entity: "complaint",
  schema: mergeSchema,
  permission: "complaint.triage",
  handler: async ({ id, originalCode }, { user }) => {
    const original = await db.complaint.findUnique({
      where: { code: originalCode.trim().toUpperCase() },
      select: { id: true, code: true, title: true, status: true },
    });
    if (!original) throw new ActionError("No complaint with that code.");
    if (original.id === id) throw new ActionError("A complaint cannot duplicate itself.");
    if (original.status === "DRAFT") throw new ActionError("That original is still a draft.");

    const duplicate = await db.complaint.findUnique({
      where: { id },
      select: { citizenId: true },
    });
    if (!duplicate) throw new ActionError("Complaint not found.");

    const merged = await transitionComplaint({
      complaintId: id,
      to: "REJECTED",
      actor: user,
      type: "MERGE",
      note: `Merged into ${original.code} — ${original.title}`,
      data: { duplicateOfId: original.id, rejectionReason: `Duplicate of ${original.code}` },
      meta: { originalId: original.id, originalCode: original.code },
    });

    await db.complaintFollower.upsert({
      where: { complaintId_userId: { complaintId: original.id, userId: duplicate.citizenId } },
      create: { complaintId: original.id, userId: duplicate.citizenId },
      update: {},
    });

    after(async () => {
      await notifyUsers([duplicate.citizenId], {
        type: "complaint.merged",
        title: `Same issue already reported — ${merged.code}`,
        body: `We joined your report to ${original.code}. You'll get every update on it.`,
        link: `/dashboard/complaints/${original.id}`,
      });
    });

    return { id: merged.id, originalId: original.id };
  },
});

/** Anyone who works a complaint may raise a hand about it, not just the triage desk. */
export const escalateComplaint = defineAction({
  name: "complaint.escalate",
  entity: "complaint",
  schema: escalateSchema,
  permission: "complaint.view_all",
  handler: async ({ id, note }, { user }) => {
    const complaint = await db.complaint.findUnique({
      where: { id },
      select: {
        id: true,
        code: true,
        title: true,
        status: true,
        citizenId: true,
        departmentId: true,
        assignedToId: true,
      },
    });
    if (!complaint || !canViewComplaint(user, complaint)) {
      throw new ActionError("Complaint not found.");
    }

    await addTimelineEntry({
      complaintId: id,
      type: "ESCALATION",
      actorId: user.id,
      isPublic: false,
      note,
    });

    after(async () => {
      const admins = await db.user.findMany({
        where: { role: { in: ["ADMIN", "SUPER_ADMIN"] }, isActive: true },
        select: { id: true },
      });
      await notifyUsers(
        admins.map((a) => a.id),
        {
          type: "complaint.escalated",
          title: `Escalated — ${complaint.code}`,
          body: note,
          link: `/office/complaints/${complaint.id}`,
        },
      );
    });

    return { id };
  },
});

// ── Department & field transitions ──────────────────────────────────────────

const advanceSchema = z.object({
  id: z.string().min(1),
  // COMPLETED is deliberately absent: `completeWork` is the only way in, because that is
  // where the "no completion without proof" rule lives. One door, one guard.
  to: z.enum(["DEPT_REVIEW", "FIELD_VERIFICATION", "IN_PROGRESS"]),
  note: z.string().trim().max(1000).optional(),
});

/**
 * The officer-side moves. One action instead of four near-identical ones: the workflow
 * map already says who may do what, so the only thing that varies is the target status.
 */
export const advanceComplaint = defineAction({
  name: "complaint.advance",
  entity: "complaint",
  schema: advanceSchema,
  permission: "complaint.view_all",
  handler: async ({ id, to, note }, { user }) => {
    const complaint = await transitionComplaint({
      complaintId: id,
      to,
      actor: user,
      note: note ?? null,
    });

    after(async () => {
      await notifyComplaint(
        complaint.id,
        {
          type: "complaint.status_changed",
          title: `${STATUS_LABEL[complaint.status]} — ${complaint.code}`,
          body: note || `Your concern is now: ${STATUS_LABEL[complaint.status].toLowerCase()}.`,
        },
        { exceptUserId: user.id },
      );
    });

    return { id: complaint.id, status: complaint.status };
  },
});
