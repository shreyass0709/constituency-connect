/**
 * Turn a stored Cloudinary URL into one safe to hand an anonymous visitor.
 *
 * Why this exists: the URL we store is the *original* asset, and Cloudinary serves the
 * original byte-for-byte — EXIF included. Complaint photos and field-officer proof shots
 * are taken on phones at the reported location, so that EXIF carries the exact GPS of
 * someone's house. Publishing it undoes `jitterPoint` completely: the map moves the pin
 * ~50 m, then the story image beside it gives the real coordinate to anyone who runs
 * `exiftool` on it (docs/02-architecture.md §8, PII exposure).
 *
 * Any transformation makes Cloudinary serve a *derived* asset, and derived assets drop
 * metadata unless you explicitly ask to keep it. `f_auto,q_auto` is the transformation we
 * would want anyway — it is the format/quality pair, and stripping EXIF is the point.
 *
 * Not a Cloudinary URL (a seeded fixture, a hand-entered link) → returned untouched;
 * there is nothing here to rewrite and guessing would break the image.
 */
const TRANSFORM = "f_auto,q_auto";

export function publicImageUrl(url: string): string;
export function publicImageUrl(url: string | null | undefined): string | null;
export function publicImageUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (!url.includes("res.cloudinary.com/")) return url;

  // `/upload/` appears once in a delivery URL, before the optional version segment.
  const marker = "/upload/";
  const at = url.indexOf(marker);
  if (at === -1) return url;

  const rest = url.slice(at + marker.length);
  // Already carries a transformation (ours or anyone's) — leave it alone rather than
  // stacking a second one.
  if (!rest.startsWith("v") && rest.includes("/")) return url;

  return `${url.slice(0, at + marker.length)}${TRANSFORM}/${rest}`;
}
