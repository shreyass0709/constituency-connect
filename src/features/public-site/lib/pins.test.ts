import { describe, expect, it } from "vitest";
import { distanceMeters } from "@/features/complaints/lib/geo";
import { PUBLIC_MAP_WHERE, toComplaintPin, type PublicComplaintRow } from "./pins";

/**
 * Gate M4's hard requirement: no PII on any public surface. The map is the only place a
 * complaint row reaches an anonymous visitor, so this is the test that has to hold.
 */

const ALLOWED_KEYS = [
  "id",
  "kind",
  "status",
  "category",
  "title",
  "latitude",
  "longitude",
  "beforeImage",
  "afterImage",
  "storySlug",
].sort();

const row: PublicComplaintRow = {
  id: "complaint-1",
  status: "CLOSED",
  category: "ROAD",
  latitude: 12.9716,
  longitude: 77.5946,
  impactStory: {
    slug: "market-road-repaired",
    beforeImage: "https://example.test/before.jpg",
    afterImage: "https://example.test/after.jpg",
    publishedAt: new Date("2026-07-01"),
  },
};

describe("public map pins", () => {
  it("emits only the allowlisted fields", () => {
    const pin = toComplaintPin(row);
    expect(Object.keys(pin).sort()).toEqual(ALLOWED_KEYS);
  });

  it("carries no citizen identity, address or free text", () => {
    // Anything a citizen wrote can name a person or a house; the pin gets a category.
    const serialised = JSON.stringify(
      toComplaintPin({
        ...row,
        // Fields a careless `select: true` would drag in.
        ...({
          description: "Ravi at house 12 says the drain floods his yard",
          address: "12 Market Road",
          citizen: { name: "Ravi Citizen", phone: "+919000000101" },
        } as object),
      }),
    );

    expect(serialised).not.toContain("Ravi");
    expect(serialised).not.toContain("9000000101");
    expect(serialised).not.toContain("Market Road");
    expect(serialised).not.toContain("drain floods");
  });

  it("never publishes the true position", () => {
    const pin = toComplaintPin(row);
    expect(pin.latitude).not.toBe(row.latitude);
    expect(pin.longitude).not.toBe(row.longitude);
    expect(
      distanceMeters(
        { latitude: row.latitude!, longitude: row.longitude! },
        { latitude: pin.latitude, longitude: pin.longitude },
      ),
    ).toBeLessThanOrEqual(55);
  });

  it("only links a story once it is actually published", () => {
    expect(toComplaintPin(row).storySlug).toBe("market-road-repaired");

    const unpublished = toComplaintPin({
      ...row,
      impactStory: { ...row.impactStory!, publishedAt: null },
    });
    expect(unpublished.storySlug).toBe(null);
    expect(unpublished.beforeImage).toBe(null);
    expect(unpublished.afterImage).toBe(null);
  });

  it("excludes private and unsubmitted complaints at the query level", () => {
    expect(PUBLIC_MAP_WHERE.isPrivate).toBe(false);
    expect(PUBLIC_MAP_WHERE.status.in).not.toContain("DRAFT");
    expect(PUBLIC_MAP_WHERE.status.in).not.toContain("SUBMITTED");
    expect(PUBLIC_MAP_WHERE.status.in).not.toContain("REJECTED");
  });
});
