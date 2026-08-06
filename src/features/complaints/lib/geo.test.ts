import { describe, expect, it } from "vitest";
import { distanceMeters, inBoundary, resolveWardId } from "./geo";

// A 1°×1° square with a hole in the middle, in GeoJSON [lng, lat] order.
const square = {
  type: "Polygon",
  coordinates: [
    [
      [77, 12],
      [78, 12],
      [78, 13],
      [77, 13],
      [77, 12],
    ],
    [
      [77.4, 12.4],
      [77.6, 12.4],
      [77.6, 12.6],
      [77.4, 12.6],
      [77.4, 12.4],
    ],
  ],
};

describe("inBoundary", () => {
  it("finds points inside, outside, and in the hole", () => {
    expect(inBoundary(square, 12.2, 77.2)).toBe(true);
    expect(inBoundary(square, 12.5, 77.5)).toBe(false); // the hole
    expect(inBoundary(square, 14, 77.2)).toBe(false);
    expect(inBoundary(square, 12.2, 90)).toBe(false);
  });

  it("survives wards with no boundary drawn yet", () => {
    expect(inBoundary(null, 12.2, 77.2)).toBe(false);
    expect(inBoundary({ nonsense: true }, 12.2, 77.2)).toBe(false);
  });
});

describe("distanceMeters", () => {
  const site = { latitude: 12.9716, longitude: 77.5946 };

  it("is zero at the same point and grows with separation", () => {
    expect(distanceMeters(site, site)).toBe(0);
    // ~0.001° of latitude is ~111 m
    expect(distanceMeters(site, { ...site, latitude: 12.9726 })).toBeGreaterThan(100);
    expect(distanceMeters(site, { ...site, latitude: 12.9726 })).toBeLessThan(120);
  });

  it("separates on-site proof from proof taken across town", () => {
    // 150 m away — inside the 200 m proof radius
    expect(distanceMeters(site, { latitude: 12.973, longitude: 77.5948 })).toBeLessThan(200);
    // ~3 km away — outside it
    expect(distanceMeters(site, { latitude: 13.0, longitude: 77.6 })).toBeGreaterThan(200);
  });

  it("is symmetric", () => {
    const other = { latitude: 12.98, longitude: 77.61 };
    expect(distanceMeters(site, other)).toBe(distanceMeters(other, site));
  });
});

describe("resolveWardId", () => {
  const wards = [
    { id: "w-none", boundary: null },
    { id: "w-square", boundary: square },
  ];

  it("prefers the ward containing the pin", () => {
    expect(resolveWardId(wards, { latitude: 12.2, longitude: 77.2 }, "w-home")).toBe("w-square");
  });

  it("falls back to the citizen's home ward without coordinates or a match", () => {
    expect(resolveWardId(wards, {}, "w-home")).toBe("w-home");
    expect(resolveWardId(wards, { latitude: 50, longitude: 50 }, "w-home")).toBe("w-home");
    expect(resolveWardId(wards, { latitude: 50, longitude: 50 }, null)).toBe(null);
  });
});
