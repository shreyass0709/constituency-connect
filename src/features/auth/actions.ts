"use server";

import { cookies } from "next/headers";
import { ActionError, defineAction } from "@/lib/safe-action";
import { db } from "@/lib/db";
import { LOCALE_COOKIE } from "@/i18n/request";
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

    // The cookie is what the renderer reads, so onboarding has to set it too — otherwise
    // a citizen who picks Hindi here lands on an English dashboard.
    (await cookies()).set(LOCALE_COOKIE, input.language, {
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
      sameSite: "lax",
    });

    return db.user.update({
      where: { id: user.id },
      data: { name: input.name, wardId: ward.id, language: input.language },
      select: { id: true },
    });
  },
});
