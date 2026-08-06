import { z } from "zod";

export const LANGUAGES = [
  { value: "en", label: "English" },
  { value: "hi", label: "हिन्दी" },
] as const;

export const onboardingSchema = z.object({
  name: z.string().trim().min(2, "Please enter your full name.").max(80),
  wardId: z.string().min(1, "Pick your ward."),
  language: z.enum(LANGUAGES.map((l) => l.value)),
});
