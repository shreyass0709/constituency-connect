import { describe, expect, it } from "vitest";
import { can, canEnterSection, HOME_BY_ROLE, PERMISSIONS } from "./permissions";

describe("RBAC matrix", () => {
  it("keeps citizens out of staff capabilities", () => {
    expect(can("CITIZEN", "complaint.create")).toBe(true);
    expect(can("CITIZEN", "complaint.triage")).toBe(false);
    expect(can("CITIZEN", "users.manage")).toBe(false);
  });

  it("scopes officers to their own kind of work", () => {
    expect(can("DEPARTMENT_OFFICER", "complaint.dept_update")).toBe(true);
    expect(can("DEPARTMENT_OFFICER", "users.manage")).toBe(false);
    expect(can("FIELD_OFFICER", "complaint.field_update")).toBe(true);
    expect(can("FIELD_OFFICER", "complaint.triage")).toBe(false);
  });

  it("gives the audit trail to super admin only", () => {
    const withAudit = Object.entries(PERMISSIONS)
      .filter(([, list]) => list.includes("audit.view"))
      .map(([role]) => role);
    expect(withAudit).toEqual(["SUPER_ADMIN"]);
  });
});

describe("section access", () => {
  it("sends every role to a section it may actually enter", () => {
    for (const [role, home] of Object.entries(HOME_BY_ROLE)) {
      expect(canEnterSection(role as keyof typeof HOME_BY_ROLE, home as never)).toBe(true);
    }
  });

  it("blocks cross-section access", () => {
    expect(canEnterSection("DEPARTMENT_OFFICER", "/office")).toBe(false);
    expect(canEnterSection("FIELD_OFFICER", "/office")).toBe(false);
    expect(canEnterSection("CITIZEN", "/field")).toBe(false);
    expect(canEnterSection("OFFICE_STAFF", "/department")).toBe(false);
  });

  it("lets any signed-in role use the citizen surface", () => {
    expect(canEnterSection("ADMIN", "/dashboard")).toBe(true);
    expect(canEnterSection("FIELD_OFFICER", "/dashboard")).toBe(true);
  });
});
