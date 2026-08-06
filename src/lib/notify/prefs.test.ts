import { describe, expect, it } from "vitest";
import { DEFAULT_PREFS, prefsOf } from "./prefs";

describe("notification preferences", () => {
  it("treats an unset preference as opted in", () => {
    // Nobody sets these at sign-up, so the default decides whether anyone is ever told.
    expect(prefsOf(null)).toEqual(DEFAULT_PREFS);
    expect(prefsOf(undefined)).toEqual(DEFAULT_PREFS);
    expect(prefsOf({})).toEqual(DEFAULT_PREFS);
  });

  it("keeps an explicit opt-out", () => {
    expect(prefsOf({ push: false, email: true })).toEqual({ push: false, email: true });
    expect(prefsOf({ push: true, email: false })).toEqual({ push: true, email: false });
  });

  it("fills in only the missing half of a partial row", () => {
    expect(prefsOf({ email: false })).toEqual({ push: true, email: false });
  });

  it("falls back rather than throwing on junk", () => {
    expect(prefsOf("nonsense")).toEqual(DEFAULT_PREFS);
    expect(prefsOf({ push: "yes" })).toEqual(DEFAULT_PREFS);
  });
});
