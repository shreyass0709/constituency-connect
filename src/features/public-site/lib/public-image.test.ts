import { describe, expect, it } from "vitest";
import { toComplaintPin, type PublicComplaintRow } from "./pins";
import { publicImageUrl } from "./public-image";

/**
 * The original Cloudinary asset is served byte-for-byte, EXIF included, and complaint
 * photos are phone photos taken at the reported spot. Publishing one hands out the GPS
 * that `jitterPoint` exists to hide (docs/02-architecture.md §8, PII exposure).
 */

const ORIGINAL =
  "https://res.cloudinary.com/demo/image/upload/v1699999999/constituency-connect/images/pothole.jpg";

describe("publicImageUrl", () => {
  it("inserts a transformation, which is what makes Cloudinary drop the metadata", () => {
    expect(publicImageUrl(ORIGINAL)).toBe(
      "https://res.cloudinary.com/demo/image/upload/f_auto,q_auto/v1699999999/constituency-connect/images/pothole.jpg",
    );
  });

  it("passes null and undefined through", () => {
    expect(publicImageUrl(null)).toBeNull();
    expect(publicImageUrl(undefined)).toBeNull();
  });

  it("leaves a non-Cloudinary URL alone rather than guessing at its shape", () => {
    expect(publicImageUrl("https://example.org/seed/photo.jpg")).toBe(
      "https://example.org/seed/photo.jpg",
    );
  });

  it("does not stack a second transformation on a URL that already has one", () => {
    const already = "https://res.cloudinary.com/demo/image/upload/w_400/v1/a/b.jpg";
    expect(publicImageUrl(already)).toBe(already);
  });

  it("handles a delivery URL with no version segment", () => {
    expect(publicImageUrl("https://res.cloudinary.com/demo/image/upload/photo.jpg")).toBe(
      "https://res.cloudinary.com/demo/image/upload/f_auto,q_auto/photo.jpg",
    );
  });
});

describe("map pins", () => {
  it("never ships an untransformed original to the public map", () => {
    const row: PublicComplaintRow = {
      id: "cmp_1",
      status: "COMPLETED",
      category: "ROAD",
      latitude: 12.9716,
      longitude: 77.5946,
      impactStory: {
        slug: "the-road-got-fixed",
        beforeImage: ORIGINAL,
        afterImage: ORIGINAL,
        publishedAt: new Date("2026-01-01"),
      },
    };

    const pin = toComplaintPin(row);

    expect(pin.beforeImage).not.toBe(ORIGINAL);
    expect(pin.afterImage).not.toBe(ORIGINAL);
    expect(pin.beforeImage).toContain("f_auto,q_auto");
    expect(pin.afterImage).toContain("f_auto,q_auto");

    // And the jitter it exists to protect is still doing its own job.
    expect(pin.latitude).not.toBe(row.latitude);
    expect(pin.longitude).not.toBe(row.longitude);
  });
});
