"use server";

import { ActionError, defineAction } from "@/lib/safe-action";
import { db } from "@/lib/db";
import { onboardingSchema } from "./schemas";

// The one mutation that runs before onboarding is complete (hence allowIncomplete) —
// it is what completes it.
export const completeOnboarding = defineAction({
  name: "user.onboard",
  entity: "user",
  schema: onboardingSchema,
  allowIncomplete: true,
  handler: async (input, { user }) => {
    const ward = await db.ward.findUnique({ where: { id: input.wardId }, select: { id: true } });
    if (!ward) throw new ActionError("That ward no longer exists. Pick another.");

    return db.user.update({
      where: { id: user.id },
      data: { name: input.name, wardId: ward.id, language: input.language },
      select: { id: true },
    });
  },
});
