import type { Role } from "@/generated/prisma/enums";

// One source of truth for RBAC — mirrors the matrix in docs/01-requirements.md §3.
// Row-level scoping (dept officer → own department, field officer → own assignments,
// citizen → own complaints) is NOT expressed here; it lives in the queries/actions that
// touch rows. This file answers "may this role do this kind of thing at all".
export type Permission =
  | "complaint.create" // raise/track own complaints, feedback
  | "engagement.participate" // polls, suggestions, appointments, volunteer
  | "complaint.view_all" // dept officer = own dept, field officer = own assignments
  | "complaint.triage" // categorize, assign, merge, reject
  | "complaint.dept_update" // dept review, scheduling
  | "complaint.field_update" // field proof, notes, signature
  | "analytics.view"
  | "reports.export"
  | "content.publish"
  | "users.manage"
  | "settings.manage" // wards, departments, SLA policies, feature flags
  | "audit.view"; // + destructive ops

const EVERYONE: Permission[] = ["complaint.create", "engagement.participate"];
const STAFF: Permission[] = [
  "complaint.view_all",
  "complaint.triage",
  "analytics.view",
  "reports.export",
  "content.publish",
];
const ADMIN: Permission[] = [
  ...STAFF,
  "complaint.dept_update",
  "complaint.field_update",
  "users.manage",
  "settings.manage",
];

export const PERMISSIONS: Record<Role, readonly Permission[]> = {
  CITIZEN: EVERYONE,
  OFFICE_STAFF: [...EVERYONE, ...STAFF],
  DEPARTMENT_OFFICER: [
    ...EVERYONE,
    "complaint.view_all",
    "complaint.dept_update",
    "analytics.view",
    "reports.export",
  ],
  FIELD_OFFICER: [...EVERYONE, "complaint.view_all", "complaint.field_update"],
  REPRESENTATIVE: [
    ...EVERYONE,
    "complaint.view_all",
    "analytics.view",
    "reports.export",
    "content.publish",
  ],
  ADMIN: [...EVERYONE, ...ADMIN],
  SUPER_ADMIN: [...EVERYONE, ...ADMIN, "audit.view"],
};

export function can(role: Role, permission: Permission): boolean {
  return PERMISSIONS[role].includes(permission);
}

// Where a role lands after login, and where it gets sent when it hits a route
// group it has no business in.
export const HOME_BY_ROLE: Record<Role, string> = {
  CITIZEN: "/dashboard",
  OFFICE_STAFF: "/office",
  DEPARTMENT_OFFICER: "/department",
  FIELD_OFFICER: "/field",
  REPRESENTATIVE: "/office",
  ADMIN: "/office",
  SUPER_ADMIN: "/office",
};

/** A role-scoped route group. Each has a layout that calls `requireSection`. */
export type Section = "/dashboard" | "/office" | "/department" | "/field";

/**
 * Staff sections belong to exactly the roles that live in them; /dashboard is the
 * citizen surface every signed-in user may use (staff raise complaints too).
 */
export function canEnterSection(role: Role, section: Section): boolean {
  return section === "/dashboard" || HOME_BY_ROLE[role] === section;
}
