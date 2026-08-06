import { describe, expect, it } from "vitest";
import { distanceMeters } from "@/features/complaints/lib/geo";
import { jitterPoint } from "./jitter";

const site = { latitude: 12.9716, longitude: 77.5946 };

describe("public map jitter", () => {
  it("never publishes the true position", () => {
    const pin = jitterPoint(site.latitude, site.longitude, "complaint-1");
    expect(pin).not.toEqual(site);
  });

  it("stays within ~50 m so the street is still right", () => {
    for (let i = 0; i < 200; i++) {
      const pin = jitterPoint(site.latitude, site.longitude, `complaint-${i}`);
      expect(distanceMeters(site, pin)).toBeLessThanOrEqual(55);
    }
  });

  it("is stable for the same complaint", () => {
    // Re-rolling per request would let anyone average the samples back to the real spot.
    const first = jitterPoint(site.latitude, site.longitude, "complaint-42");
    const second = jitterPoint(site.latitude, site.longitude, "complaint-42");
    expect(second).toEqual(first);
  });

  it("moves different complaints in different directions", () => {
    const a = jitterPoint(site.latitude, site.longitude, "complaint-a");
    const b = jitterPoint(site.latitude, site.longitude, "complaint-b");
    expect(a).not.toEqual(b);
  });

  it("holds up near the equator and far from it", () => {
    for (const latitude of [0, 34, -34, 60]) {
      const pin = jitterPoint(latitude, 77, "complaint-x");
      expect(distanceMeters({ latitude, longitude: 77 }, pin)).toBeLessThanOrEqual(55);
    }
  });
});
