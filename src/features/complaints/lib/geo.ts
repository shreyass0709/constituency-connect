/**
 * Ward resolution from a dropped pin. Wards carry an optional GeoJSON boundary; until
 * an admin draws them (Phase 4's ward editor) every complaint falls back to the
 * citizen's home ward, which onboarding guarantees exists.
 *
 * ponytail: JS ray-casting over a handful of wards, run once per submission. PostGIS
 * enters the picture only when ward count or polygon detail makes this measurably slow
 * (docs/06-roadmap.md "deliberately cut").
 */

type Ring = [number, number][]; // GeoJSON order: [lng, lat]

/** Standard even-odd ray casting; a point exactly on an edge counts as inside-ish. */
function inRing(lng: number, lat: number, ring: Ring): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i]!;
    const [xj, yj] = ring[j]!;
    const straddles = yi > lat !== yj > lat;
    if (straddles && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** True when the point is inside the outer ring of a Polygon/MultiPolygon and not in a hole. */
export function inBoundary(boundary: unknown, lat: number, lng: number): boolean {
  const geometry = boundary as
    | { type?: string; coordinates?: unknown }
    | { geometry?: { type?: string; coordinates?: unknown } }
    | null;
  if (!geometry) return false;
  const geo = "geometry" in geometry && geometry.geometry ? geometry.geometry : geometry;
  const coordinates = (geo as { coordinates?: unknown }).coordinates;
  if (!Array.isArray(coordinates)) return false;

  // Polygon = [ring, …holes]; MultiPolygon = [polygon, …].
  const polygons: Ring[][] =
    (geo as { type?: string }).type === "MultiPolygon"
      ? (coordinates as Ring[][])
      : [coordinates as Ring[]];

  return polygons.some((rings) => {
    const [outer, ...holes] = rings;
    if (!outer?.length) return false;
    return inRing(lng, lat, outer) && !holes.some((hole) => inRing(lng, lat, hole));
  });
}

/**
 * Straight-line distance in metres (haversine). Used to check that a field officer's
 * proof photo was taken at the complaint, and to sort a day's tasks by how far away they
 * are. Earth-as-a-sphere is plenty at neighbourhood scale.
 */
export function distanceMeters(
  from: { latitude: number; longitude: number },
  to: { latitude: number; longitude: number },
): number {
  const R = 6_371_000;
  const toRad = (degrees: number) => (degrees * Math.PI) / 180;
  const dLat = toRad(to.latitude - from.latitude);
  const dLng = toRad(to.longitude - from.longitude);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(from.latitude)) * Math.cos(toRad(to.latitude)) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.min(1, Math.sqrt(a))));
}

/** How far a proof photo may have been taken from the complaint before we flag it. */
export const GEO_PROOF_RADIUS_M = 200;

/** The ward whose boundary contains the pin, or `fallbackWardId` when none does. */
export function resolveWardId(
  wards: { id: string; boundary: unknown }[],
  point: { latitude?: number | null; longitude?: number | null },
  fallbackWardId: string | null,
): string | null {
  const { latitude, longitude } = point;
  if (typeof latitude !== "number" || typeof longitude !== "number") return fallbackWardId;
  return wards.find((w) => inBoundary(w.boundary, latitude, longitude))?.id ?? fallbackWardId;
}
