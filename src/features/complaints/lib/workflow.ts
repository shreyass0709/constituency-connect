import type { ComplaintStatus, Role } from "@/generated/prisma/enums";
import { can, type Permission } from "@/lib/auth/permissions";

/**
 * The one place a complaint's life is described (docs/02-architecture.md §1).
 * Every transition action asks `canTransition` first, so an illegal move is impossible
 * rather than merely un-clickable. Adding a status means editing this file and nothing
 * else — the test suite next door fails loudly if the maps drift apart.
 */
export const ALLOWED = {
  DRAFT: ["SUBMITTED"],
  SUBMITTED: ["ACKNOWLEDGED", "REJECTED"],
  ACKNOWLEDGED: ["ASSIGNED", "REJECTED"],
  ASSIGNED: ["DEPT_REVIEW", "IN_PROGRESS", "REJECTED"],
  DEPT_REVIEW: ["FIELD_VERIFICATION", "IN_PROGRESS", "REJECTED"],
  FIELD_VERIFICATION: ["IN_PROGRESS", "REJECTED"],
  IN_PROGRESS: ["COMPLETED"],
  COMPLETED: ["CLOSED", "REOPENED"],
  REOPENED: ["ASSIGNED", "IN_PROGRESS", "REJECTED"],
  CLOSED: [],
  REJECTED: [],
} as const satisfies Record<ComplaintStatus, readonly ComplaintStatus[]>;

/**
 * Who may drive a complaint *into* a status. Keyed by target because the answer never
 * depends on where it came from: only triage assigns, only the field closes out work,
 * only the citizen who raised it can accept or dispute the result.
 * `"owner"` = the citizen on the row. `"system"` = cron (7-day auto-close).
 */
type Requirement = Permission | "owner" | "system";

export const REQUIRED_FOR = {
  SUBMITTED: ["owner"],
  ACKNOWLEDGED: ["complaint.triage"],
  ASSIGNED: ["complaint.triage"],
  REJECTED: ["complaint.triage"],
  DEPT_REVIEW: ["complaint.dept_update"],
  FIELD_VERIFICATION: ["complaint.dept_update"],
  IN_PROGRESS: ["complaint.field_update"],
  COMPLETED: ["complaint.field_update"],
  CLOSED: ["owner", "system"],
  REOPENED: ["owner"],
  DRAFT: [], // nothing transitions *back* into a draft
} as const satisfies Record<ComplaintStatus, readonly Requirement[]>;

/** The cron/auto-close caller, or a signed-in user and whether the row is theirs. */
export type TransitionActor = "system" | { role: Role; isOwner?: boolean };

function meets(actor: TransitionActor, requirement: Requirement): boolean {
  if (requirement === "system") return actor === "system";
  if (actor === "system") return false; // the system only does what it is listed for
  if (requirement === "owner") return actor.isOwner === true;
  return can(actor.role, requirement);
}

export function canTransition(
  actor: TransitionActor,
  from: ComplaintStatus,
  to: ComplaintStatus,
): boolean {
  const targets: readonly ComplaintStatus[] = ALLOWED[from];
  if (!targets.includes(to)) return false;
  return REQUIRED_FOR[to].some((requirement) => meets(actor, requirement));
}

/** Drives which buttons a viewer is offered on the detail page. */
export function nextStatuses(
  actor: TransitionActor,
  from: ComplaintStatus,
): ComplaintStatus[] {
  return ALLOWED[from].filter((to) => canTransition(actor, from, to));
}

export function isTerminal(status: ComplaintStatus): boolean {
  return ALLOWED[status].length === 0;
}
