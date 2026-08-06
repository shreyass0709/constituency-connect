import { cache } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "../db";
import { auth } from "./index";
import {
  can,
  canEnterSection,
  HOME_BY_ROLE,
  type Permission,
  type Section,
} from "./permissions";

// Session + our own User row (role/ward/department live there, not in Better Auth).
// `cache` dedupes the two queries across a single render pass.
export const getCurrentUser = cache(async () => {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return null;
  return db.user.findUnique({
    where: { id: session.user.id },
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
});

export type CurrentUser = NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>;

// ponytail: "has onboarded" = a citizen with a ward. Staff/officer rows are created by
// an admin with everything filled in. Add a real `onboardedAt` column if onboarding ever
// collects something optional.
export function needsOnboarding(user: CurrentUser): boolean {
  return user.role === "CITIZEN" && !user.wardId;
}

/**
 * The real access check — every protected layout and every mutation runs it.
 * Proxy (proxy.ts) only does the cheap cookie sniff; this is what actually enforces.
 */
export async function requireUser(
  permission?: Permission,
  // `allowIncomplete` is for the onboarding page and its action only — everything else
  // must not run for a half-set-up account.
  options?: { allowIncomplete?: boolean },
): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!user.isActive) redirect("/login?error=deactivated");
  if (!options?.allowIncomplete && needsOnboarding(user)) redirect("/onboarding");
  if (permission && !can(user.role, permission)) redirect(HOME_BY_ROLE[user.role]);
  return user;
}

/** Layout guard for the role-scoped route groups: wrong section → your own home. */
export async function requireSection(section: Section): Promise<CurrentUser> {
  const user = await requireUser();
  if (!canEnterSection(user.role, section)) redirect(HOME_BY_ROLE[user.role]);
  return user;
}
