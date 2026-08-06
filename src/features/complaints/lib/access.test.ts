import { describe, expect, it } from "vitest";
import type { Role } from "@/generated/prisma/enums";
import { canViewComplaint, complaintScopeWhere, type ComplaintScope } from "./access";

const viewer = (role: Role, extra: { id?: string; departmentId?: string | null } = {}) => ({
  id: extra.id ?? "u-viewer",
  role,
  departmentId: extra.departmentId ?? null,
});

const complaint: ComplaintScope = {
  citizenId: "u-citizen",
  departmentId: "d-roads",
  assignedToId: "u-field",
};

describe("canViewComplaint", () => {
  it("always shows a citizen their own complaint", () => {
    expect(canViewComplaint(viewer("CITIZEN", { id: "u-citizen" }), complaint)).toBe(true);
    expect(canViewComplaint(viewer("CITIZEN"), complaint)).toBe(false);
  });

  it("opens every complaint to the office", () => {
    for (const role of ["OFFICE_STAFF", "REPRESENTATIVE", "ADMIN", "SUPER_ADMIN"] as const) {
      expect(canViewComplaint(viewer(role), complaint)).toBe(true);
    }
  });

  it("fences a department officer inside their department", () => {
    expect(canViewComplaint(viewer("DEPARTMENT_OFFICER", { departmentId: "d-roads" }), complaint)).toBe(true);
    expect(canViewComplaint(viewer("DEPARTMENT_OFFICER", { departmentId: "d-water" }), complaint)).toBe(false);
    expect(canViewComplaint(viewer("DEPARTMENT_OFFICER"), complaint)).toBe(false);
    // an unassigned complaint belongs to no department, so nobody's department matches
    expect(
      canViewComplaint(viewer("DEPARTMENT_OFFICER"), { ...complaint, departmentId: null }),
    ).toBe(false);
  });

  it("fences a field officer to their own assignments", () => {
    expect(canViewComplaint(viewer("FIELD_OFFICER", { id: "u-field" }), complaint)).toBe(true);
    expect(canViewComplaint(viewer("FIELD_OFFICER", { id: "u-other" }), complaint)).toBe(false);
  });
});

describe("complaintScopeWhere agrees with canViewComplaint", () => {
  // The filter and the predicate are separate implementations of one rule; this keeps
  // them honest about the cases that matter.
  it("narrows for scoped roles and stays open for the office", () => {
    expect(complaintScopeWhere(viewer("OFFICE_STAFF"))).toEqual({});
    expect(complaintScopeWhere(viewer("CITIZEN", { id: "u-citizen" }))).toEqual({
      citizenId: "u-citizen",
    });
    expect(complaintScopeWhere(viewer("FIELD_OFFICER", { id: "u-field" }))).toEqual({
      OR: [{ citizenId: "u-field" }, { assignedToId: "u-field" }],
    });
    expect(complaintScopeWhere(viewer("DEPARTMENT_OFFICER", { departmentId: "d-roads" }))).toEqual({
      OR: [{ citizenId: "u-viewer" }, { departmentId: "d-roads" }],
    });
    // no department on the officer row ⇒ no department-wide access, not "all rows"
    expect(complaintScopeWhere(viewer("DEPARTMENT_OFFICER"))).toEqual({ citizenId: "u-viewer" });
  });
});
