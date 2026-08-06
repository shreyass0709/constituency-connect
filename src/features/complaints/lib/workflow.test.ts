import { describe, expect, it } from "vitest";
import type { ComplaintStatus } from "@/generated/prisma/enums";
import { ALLOWED, canTransition, isTerminal, nextStatuses } from "./workflow";

const ALL = Object.keys(ALLOWED) as ComplaintStatus[];

const citizen = { role: "CITIZEN" } as const;
const owner = { role: "CITIZEN", isOwner: true } as const;
const staff = { role: "OFFICE_STAFF" } as const;
const dept = { role: "DEPARTMENT_OFFICER" } as const;
const field = { role: "FIELD_OFFICER" } as const;
const admin = { role: "ADMIN" } as const;

describe("transition map", () => {
  it("only ever points at real statuses, never at itself", () => {
    for (const from of ALL) {
      for (const to of ALLOWED[from]) {
        expect(ALL).toContain(to);
        expect(to).not.toBe(from);
      }
    }
  });

  it("treats CLOSED and REJECTED as the only dead ends", () => {
    expect(ALL.filter(isTerminal)).toEqual(["CLOSED", "REJECTED"]);
  });

  it("leaves no status stranded — everything is reachable from DRAFT", () => {
    const seen = new Set<ComplaintStatus>(["DRAFT"]);
    const queue: ComplaintStatus[] = ["DRAFT"];
    while (queue.length) {
      for (const to of ALLOWED[queue.pop()!]) {
        if (seen.has(to)) continue;
        seen.add(to);
        queue.push(to);
      }
    }
    expect([...seen].sort()).toEqual([...ALL].sort());
  });
});

describe("who may move a complaint", () => {
  it("lets the citizen who raised it submit, and nobody else", () => {
    expect(canTransition(owner, "DRAFT", "SUBMITTED")).toBe(true);
    expect(canTransition(citizen, "DRAFT", "SUBMITTED")).toBe(false);
    expect(canTransition(staff, "DRAFT", "SUBMITTED")).toBe(false);
    expect(canTransition(admin, "DRAFT", "SUBMITTED")).toBe(false);
  });

  it("keeps triage with the office", () => {
    expect(canTransition(staff, "SUBMITTED", "ACKNOWLEDGED")).toBe(true);
    expect(canTransition(staff, "ACKNOWLEDGED", "ASSIGNED")).toBe(true);
    expect(canTransition(admin, "SUBMITTED", "ACKNOWLEDGED")).toBe(true);
    expect(canTransition(owner, "SUBMITTED", "ACKNOWLEDGED")).toBe(false);
    expect(canTransition(dept, "SUBMITTED", "ACKNOWLEDGED")).toBe(false);
    expect(canTransition(field, "ACKNOWLEDGED", "ASSIGNED")).toBe(false);
  });

  it("keeps field work with the field officer", () => {
    expect(canTransition(field, "ASSIGNED", "IN_PROGRESS")).toBe(true);
    expect(canTransition(field, "IN_PROGRESS", "COMPLETED")).toBe(true);
    expect(canTransition(dept, "IN_PROGRESS", "COMPLETED")).toBe(false);
    expect(canTransition(staff, "IN_PROGRESS", "COMPLETED")).toBe(false);
  });

  it("keeps scheduling with the department", () => {
    expect(canTransition(dept, "ASSIGNED", "DEPT_REVIEW")).toBe(true);
    expect(canTransition(dept, "DEPT_REVIEW", "FIELD_VERIFICATION")).toBe(true);
    expect(canTransition(staff, "ASSIGNED", "DEPT_REVIEW")).toBe(false);
    expect(canTransition(field, "DEPT_REVIEW", "FIELD_VERIFICATION")).toBe(false);
  });

  it("gives the verdict on a completed job to the citizen alone", () => {
    expect(canTransition(owner, "COMPLETED", "CLOSED")).toBe(true);
    expect(canTransition(owner, "COMPLETED", "REOPENED")).toBe(true);
    expect(canTransition(admin, "COMPLETED", "CLOSED")).toBe(false);
    expect(canTransition(citizen, "COMPLETED", "REOPENED")).toBe(false);
    // …and the 7-day auto-close, which is the system's only power
    expect(canTransition("system", "COMPLETED", "CLOSED")).toBe(true);
    expect(canTransition("system", "COMPLETED", "REOPENED")).toBe(false);
    expect(canTransition("system", "SUBMITTED", "ACKNOWLEDGED")).toBe(false);
  });

  it("refuses to skip steps or revive a finished complaint", () => {
    expect(canTransition(staff, "SUBMITTED", "ASSIGNED")).toBe(false);
    expect(canTransition(field, "SUBMITTED", "COMPLETED")).toBe(false);
    expect(canTransition(owner, "IN_PROGRESS", "CLOSED")).toBe(false);
    expect(canTransition(admin, "CLOSED", "REOPENED")).toBe(false);
    expect(canTransition(admin, "REJECTED", "SUBMITTED")).toBe(false);
  });

  it("offers each role exactly the moves it can make", () => {
    expect(nextStatuses(staff, "ACKNOWLEDGED")).toEqual(["ASSIGNED", "REJECTED"]);
    expect(nextStatuses(field, "ASSIGNED")).toEqual(["IN_PROGRESS"]);
    expect(nextStatuses(owner, "COMPLETED")).toEqual(["CLOSED", "REOPENED"]);
    expect(nextStatuses(citizen, "SUBMITTED")).toEqual([]);
  });
});
