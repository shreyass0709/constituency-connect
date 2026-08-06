import { z } from "zod";
import { AppointmentStatus, SuggestionStatus, VolunteerStatus } from "@/generated/prisma/enums";

export const bookAppointmentSchema = z.object({
  purpose: z.string().trim().min(10, "Tell the office what it is about.").max(500),
  requestedDate: z.coerce.date(),
  slot: z.string().trim().max(40).nullish(),
});

export const appointmentIdSchema = z.object({ id: z.string().min(1) });

export const updateAppointmentSchema = z.object({
  id: z.string().min(1),
  status: z.enum(AppointmentStatus),
  staffNote: z.string().trim().max(500).nullish(),
});

export const callbackSchema = z.object({
  phone: z
    .string()
    .trim()
    .regex(/^\+?[0-9\s-]{7,15}$/, "Enter a phone number we can call back on."),
  topic: z.string().trim().min(5, "What is it about?").max(200),
  preferredTime: z.string().trim().max(60).nullish(),
});

export const resolveCallbackSchema = z.object({ id: z.string().min(1) });

export const createPollSchema = z.object({
  question: z.string().trim().min(10, "Ask a full question.").max(200),
  options: z
    .array(z.string().trim().min(1).max(80))
    .min(2, "A poll needs at least two options.")
    .max(6),
  startsAt: z.coerce.date(),
  endsAt: z.coerce.date(),
});

export const votePollSchema = z.object({
  pollId: z.string().min(1),
  optionId: z.string().min(1),
});

export const createSuggestionSchema = z.object({
  title: z.string().trim().min(8, "Give your idea a title.").max(120),
  body: z.string().trim().min(20, "Explain the idea a little.").max(2000),
});

export const voteSuggestionSchema = z.object({ suggestionId: z.string().min(1) });

export const updateSuggestionSchema = z.object({
  id: z.string().min(1),
  status: z.enum(SuggestionStatus),
});

export const volunteerSchema = z.object({
  skills: z.array(z.string().trim().min(1).max(40)).max(10),
  availability: z.string().trim().max(200).nullish(),
});

export const updateVolunteerSchema = z.object({
  id: z.string().min(1),
  status: z.enum(VolunteerStatus),
});
