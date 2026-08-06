"use server";

import { after } from "next/server";
import { randomUUID } from "node:crypto";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { notifyUsers } from "@/lib/notify";
import { ActionError, defineAction } from "@/lib/safe-action";
import {
  appointmentIdSchema,
  bookAppointmentSchema,
  callbackSchema,
  createPollSchema,
  createSuggestionSchema,
  resolveCallbackSchema,
  updateAppointmentSchema,
  updateSuggestionSchema,
  updateVolunteerSchema,
  volunteerSchema,
  votePollSchema,
  voteSuggestionSchema,
} from "./schemas";

// Everything a citizen can do besides raise a complaint, plus the staff side of each.
// Same pipeline as every other mutation: Zod → session → RBAC → handler → audit.

// ── Appointments ────────────────────────────────────────────────────────────

export const bookAppointment = defineAction({
  name: "appointment.book",
  entity: "appointment",
  schema: bookAppointmentSchema,
  permission: "engagement.participate",
  handler: async (input, { user }) => {
    if (input.requestedDate.getTime() < Date.now() - 86_400_000) {
      throw new ActionError("Pick a date that has not already passed.");
    }

    // One open request at a time keeps the staff calendar honest.
    const pending = await db.appointment.count({
      where: { citizenId: user.id, status: { in: ["REQUESTED", "CONFIRMED"] } },
    });
    if (pending >= 3) {
      throw new ActionError("You already have three appointments pending with the office.");
    }

    const appointment = await db.appointment.create({
      data: { ...input, citizenId: user.id },
      select: { id: true },
    });

    after(async () => {
      const staff = await db.user.findMany({
        where: { role: { in: ["OFFICE_STAFF", "ADMIN"] }, isActive: true },
        select: { id: true },
      });
      await notifyUsers(
        staff.map((member) => member.id),
        {
          type: "appointment.requested",
          title: "New appointment request",
          body: input.purpose,
          link: "/office/engagement",
        },
      );
    });

    return appointment;
  },
});

export const cancelAppointment = defineAction({
  name: "appointment.cancel",
  entity: "appointment",
  schema: appointmentIdSchema,
  permission: "engagement.participate",
  handler: async ({ id }, { user }) => {
    const appointment = await db.appointment.findUnique({
      where: { id },
      select: { citizenId: true, status: true },
    });
    if (!appointment || appointment.citizenId !== user.id) {
      throw new ActionError("Appointment not found.");
    }
    if (appointment.status === "COMPLETED") {
      throw new ActionError("That appointment has already happened.");
    }

    await db.appointment.update({ where: { id }, data: { status: "CANCELLED" } });
    return { id };
  },
});

export const updateAppointmentStatus = defineAction({
  name: "appointment.update",
  entity: "appointment",
  schema: updateAppointmentSchema,
  permission: "complaint.triage",
  handler: async ({ id, status, staffNote }) => {
    const appointment = await db.appointment.update({
      where: { id },
      data: { status, staffNote },
      select: { id: true, citizenId: true, requestedDate: true, slot: true },
    });

    after(async () => {
      await notifyUsers([appointment.citizenId], {
        type: "appointment.updated",
        title: `Appointment ${status.toLowerCase()}`,
        body: staffNote ?? `Your appointment request is now ${status.toLowerCase()}.`,
        link: "/dashboard/engage",
      });
    });

    return { id: appointment.id };
  },
});

// ── Callback requests ───────────────────────────────────────────────────────

export const requestCallback = defineAction({
  name: "callback.request",
  entity: "callback_request",
  schema: callbackSchema,
  permission: "engagement.participate",
  handler: async (input, { user }) => {
    const open = await db.callbackRequest.count({
      where: { citizenId: user.id, status: "PENDING" },
    });
    if (open >= 2) throw new ActionError("You already have a callback pending.");

    return db.callbackRequest.create({
      data: { ...input, citizenId: user.id },
      select: { id: true },
    });
  },
});

export const resolveCallback = defineAction({
  name: "callback.resolve",
  entity: "callback_request",
  schema: resolveCallbackSchema,
  permission: "complaint.triage",
  handler: async ({ id }) => {
    const callback = await db.callbackRequest.update({
      where: { id },
      data: { status: "DONE" },
      select: { id: true, citizenId: true },
    });

    after(async () => {
      await notifyUsers([callback.citizenId], {
        type: "callback.done",
        title: "Callback marked done",
        body: "The office has recorded your callback as completed.",
        link: "/dashboard/engage",
      });
    });

    return { id: callback.id };
  },
});

// ── Polls ───────────────────────────────────────────────────────────────────

export const createPoll = defineAction({
  name: "poll.create",
  entity: "poll",
  schema: createPollSchema,
  permission: "content.publish",
  handler: async ({ question, options, startsAt, endsAt }) => {
    if (endsAt <= startsAt) throw new ActionError("The poll must close after it opens.");

    // Options carry generated ids so a vote survives the label being reworded.
    const withIds = options.map((label) => ({ id: randomUUID(), label }));
    return db.poll.create({
      data: { question, options: withIds as Prisma.InputJsonValue, startsAt, endsAt },
      select: { id: true },
    });
  },
});

export const votePoll = defineAction({
  name: "poll.vote",
  entity: "poll_vote",
  schema: votePollSchema,
  permission: "engagement.participate",
  handler: async ({ pollId, optionId }, { user }) => {
    const poll = await db.poll.findUnique({ where: { id: pollId } });
    if (!poll) throw new ActionError("Poll not found.");

    const now = new Date();
    if (now < poll.startsAt) throw new ActionError("This poll has not opened yet.");
    if (now > poll.endsAt) throw new ActionError("This poll has closed.");

    const options = poll.options as { id: string; label: string }[];
    if (!options.some((option) => option.id === optionId)) {
      throw new ActionError("That option is not on this poll.");
    }

    // One vote per user per poll is the composite primary key, not a check we can forget.
    const existing = await db.pollVote.findUnique({
      where: { pollId_userId: { pollId, userId: user.id } },
      select: { optionId: true },
    });
    if (existing) throw new ActionError("You have already voted in this poll.");

    await db.pollVote.create({ data: { pollId, userId: user.id, optionId } });
    return { pollId, optionId };
  },
});

// ── Suggestions ─────────────────────────────────────────────────────────────

export const createSuggestion = defineAction({
  name: "suggestion.create",
  entity: "suggestion",
  schema: createSuggestionSchema,
  permission: "engagement.participate",
  handler: async (input, { user }) => {
    const suggestion = await db.suggestion.create({
      data: { ...input, authorId: user.id },
      select: { id: true },
    });
    // Authors back their own idea — otherwise every new suggestion shows a lonely zero.
    await db.suggestionVote.create({
      data: { suggestionId: suggestion.id, userId: user.id },
    });
    return suggestion;
  },
});

export const voteSuggestion = defineAction({
  name: "suggestion.vote",
  entity: "suggestion_vote",
  schema: voteSuggestionSchema,
  permission: "engagement.participate",
  handler: async ({ suggestionId }, { user }) => {
    const existing = await db.suggestionVote.findUnique({
      where: { suggestionId_userId: { suggestionId, userId: user.id } },
    });

    // A second press takes the vote back rather than erroring at someone.
    if (existing) {
      await db.suggestionVote.delete({
        where: { suggestionId_userId: { suggestionId, userId: user.id } },
      });
      return { suggestionId, voted: false };
    }

    await db.suggestionVote.create({ data: { suggestionId, userId: user.id } });
    return { suggestionId, voted: true };
  },
});

export const updateSuggestionStatus = defineAction({
  name: "suggestion.update",
  entity: "suggestion",
  schema: updateSuggestionSchema,
  permission: "complaint.triage",
  handler: async ({ id, status }) => {
    const suggestion = await db.suggestion.update({
      where: { id },
      data: { status },
      select: { id: true, authorId: true, title: true },
    });

    after(async () => {
      await notifyUsers([suggestion.authorId], {
        type: "suggestion.updated",
        title: `Your suggestion is now ${status.toLowerCase()}`,
        body: suggestion.title,
        link: "/dashboard/engage",
      });
    });

    return { id: suggestion.id };
  },
});

// ── Volunteers ──────────────────────────────────────────────────────────────

export const registerVolunteer = defineAction({
  name: "volunteer.register",
  entity: "volunteer",
  schema: volunteerSchema,
  permission: "engagement.participate",
  handler: async (input, { user }) => {
    return db.volunteer.upsert({
      where: { userId: user.id },
      create: { ...input, userId: user.id },
      // Re-registering updates the details and does not reset an approved volunteer.
      update: input,
      select: { id: true, status: true },
    });
  },
});

export const updateVolunteerStatus = defineAction({
  name: "volunteer.update",
  entity: "volunteer",
  schema: updateVolunteerSchema,
  permission: "complaint.triage",
  handler: async ({ id, status }) => {
    const volunteer = await db.volunteer.update({
      where: { id },
      data: { status },
      select: { id: true, userId: true },
    });

    after(async () => {
      await notifyUsers([volunteer.userId], {
        type: "volunteer.updated",
        title: `Volunteer registration ${status.toLowerCase()}`,
        body: "The office has updated your volunteer status.",
        link: "/dashboard/engage",
      });
    });

    return { id: volunteer.id };
  },
});
