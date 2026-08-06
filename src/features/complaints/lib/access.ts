import type { Prisma } from "@/generated/prisma/client";
import type { CurrentUser } from "@/lib/auth/require-user";

/**
 * Row-level scoping — the half of RBAC that `permissions.ts` deliberately does not
 * answer ("may this role do this kind of thing at all" lives there; "on *this* row"
 * lives here). Every complaint read and every complaint mutation routes through these
 * two functions, so there is exactly one place to get it wrong.
 */

export type ComplaintScope = {
  citizenId: string;
  departmentId: string | null;
  assignedToId: string | null;
};

type Viewer = Pick<CurrentUser, "id" | "role" | "departmentId">;

export function canViewComplaint(user: Viewer, complaint: ComplaintScope): boolean {
  if (complaint.citizenId === user.id) return true; // everyone can see what they raised
  switch (user.role) {
    case "OFFICE_STAFF":
    case "REPRESENTATIVE":
    case "ADMIN":
    case "SUPER_ADMIN":
      return true;
    case "DEPARTMENT_OFFICER":
      return !!user.departmentId && complaint.departmentId === user.departmentId;
    case "FIELD_OFFICER":
      return complaint.assignedToId === user.id;
    default:
      return false;
  }
}

/** The same rule expressed as a Prisma filter, for list queries. */
export function complaintScopeWhere(user: Viewer): Prisma.ComplaintWhereInput {
  switch (user.role) {
    case "OFFICE_STAFF":
    case "REPRESENTATIVE":
    case "ADMIN":
    case "SUPER_ADMIN":
      return {};
    case "DEPARTMENT_OFFICER":
      return user.departmentId
        ? { OR: [{ citizenId: user.id }, { departmentId: user.departmentId }] }
        : { citizenId: user.id };
    case "FIELD_OFFICER":
      return { OR: [{ citizenId: user.id }, { assignedToId: user.id }] };
    default:
      return { citizenId: user.id };
  }
}
