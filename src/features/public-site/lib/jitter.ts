/**
 * Public map pins are moved off their true position by up to ~50 m.
 *
 * Why it matters: a complaint pin sitting exactly on a house, next to "drain overflowing
 * into my yard", identifies a family. Jitter keeps the street-level truth — which is the
 * whole point of the map — without handing out addresses (docs/01 §2 privacy).
 *
 * The offset is derived from the complaint id, so a pin stays where it was between page
 * loads. Random-per-request jitter would be worse than none: sample the same pin enough
 * times and the average gives you the real spot.
 */

const MAX_OFFSET_M = 50;
const METRES_PER_DEGREE_LAT = 111_320;

/** FNV-1a: a few lines, stable across runs, and nobody needs crypto strength here. */
function hash(value: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < value.length; i++) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

export function jitterPoint(
  latitude: number,
  longitude: number,
  seed: string,
): { latitude: number; longitude: number } {
  const h = hash(seed);
  const angle = ((h % 3600) / 3600) * 2 * Math.PI;
  // sqrt keeps the offsets spread evenly over the disc instead of bunching at the centre.
  const distance = Math.sqrt(((h >>> 12) % 1000) / 1000) * MAX_OFFSET_M;

  const dLat = (distance * Math.cos(angle)) / METRES_PER_DEGREE_LAT;
  const lngScale = Math.max(Math.cos((latitude * Math.PI) / 180), 0.01);
  const dLng = (distance * Math.sin(angle)) / (METRES_PER_DEGREE_LAT * lngScale);

  return {
    latitude: Number((latitude + dLat).toFixed(6)),
    longitude: Number((longitude + dLng).toFixed(6)),
  };
}
