import { z } from "zod";
import { RepresentativeType } from "@/generated/prisma/enums";

export const actionStatSchema = z.object({
  id: z.string().optional(),
  key: z
    .string()
    .trim()
    .min(2)
    .max(48)
    .regex(/^[a-z0-9_]+$/, "Use lower-case letters, numbers and underscores."),
  label: z.string().trim().min(2).max(60),
  value: z.number().int().min(0),
  sortOrder: z.number().int().min(0).max(999).default(0),
  autoComputed: z.boolean().default(false),
});

export const representativeSchema = z.object({
  name: z.string().trim().min(2).max(120),
  type: z.enum(RepresentativeType),
  constituencyName: z.string().trim().min(2).max(120),
  party: z.string().trim().max(120).nullish(),
  photo: z.string().trim().max(500).nullish(),
  bio: z.string().trim().min(10).max(4000),
  vision: z.string().trim().min(10).max(4000),
  contactEmail: z.string().trim().max(200).nullish(),
  contactPhone: z.string().trim().max(40).nullish(),
  officeAddress: z.string().trim().max(400).nullish(),
  officeHours: z.string().trim().max(200).nullish(),
});

export const storySchema = z.object({
  id: z.string().optional(),
  title: z.string().trim().min(5, "Give the story a title.").max(120),
  body: z.string().trim().min(50, "A story needs at least a paragraph.").max(5000),
  complaintId: z.string().nullish(),
  wardId: z.string().nullish(),
  coverImage: z.string().trim().max(500).nullish(),
  beforeImage: z.string().trim().max(500).nullish(),
  afterImage: z.string().trim().max(500).nullish(),
  aiGenerated: z.boolean().default(false),
});

export const publishStorySchema = z.object({
  id: z.string().min(1),
  publish: z.boolean(),
});

export const draftFromComplaintSchema = z.object({ complaintId: z.string().min(1) });
