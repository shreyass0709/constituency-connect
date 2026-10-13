import { createHash } from "node:crypto";
import type { MediaKind } from "@/generated/prisma/enums";
import { env } from "./env";

/**
 * Signed direct-to-Cloudinary uploads: the browser never sees the API secret, and the
 * signature pins the folder, the resource type and the formats Cloudinary will accept.
 *
 * Size cannot be pinned that way — Cloudinary has no signable max-bytes param, and an
 * upload preset silently drops `max_file_size` (tried). So the browser checks before
 * upload for fast feedback, and `attachMedia` asks Cloudinary what actually arrived
 * (`inspectAsset`) and deletes anything over the limit before a row is written.
 */

export const MEDIA_RULES: Record<
  MediaKind,
  {
    folder: string;
    resourceType: "image" | "video" | "raw";
    maxBytes: number;
    /** Browser file-picker hint. */
    accept: string;
    /** Enforced by Cloudinary: part of the signed upload parameters. */
    formats: string;
  }
> = {
  IMAGE: {
    folder: "constituency-connect/images",
    resourceType: "image",
    maxBytes: 10 * 1024 * 1024,
    accept: "image/jpeg,image/png,image/webp,image/heic",
    formats: "jpg,png,webp,heic",
  },
  VIDEO: {
    folder: "constituency-connect/videos",
    resourceType: "video",
    maxBytes: 100 * 1024 * 1024,
    accept: "video/mp4,video/quicktime,video/webm",
    formats: "mp4,mov,webm",
  },
  // Cloudinary serves audio through its video pipeline.
  AUDIO: {
    folder: "constituency-connect/audio",
    resourceType: "video",
    maxBytes: 20 * 1024 * 1024,
    accept: "audio/webm,audio/mpeg,audio/mp4,audio/ogg",
    formats: "webm,mp3,mp4,m4a,ogg",
  },
  DOCUMENT: {
    folder: "constituency-connect/documents",
    resourceType: "raw",
    maxBytes: 10 * 1024 * 1024,
    accept: "application/pdf",
    formats: "pdf",
  },
};

export function isCloudinaryConfigured(): boolean {
  return Boolean(
    env.CLOUDINARY_CLOUD_NAME && env.CLOUDINARY_API_KEY && env.CLOUDINARY_API_SECRET,
  );
}

/** Cloudinary's scheme: sorted `k=v` pairs joined by `&`, secret appended, SHA-1 hex. */
export function signUpload(kind: MediaKind) {
  const cloudName = env.CLOUDINARY_CLOUD_NAME;
  const apiKey = env.CLOUDINARY_API_KEY;
  const apiSecret = env.CLOUDINARY_API_SECRET;
  if (!cloudName || !apiKey || !apiSecret) throw new Error("Cloudinary is not configured");

  const rule = MEDIA_RULES[kind];
  const params: Record<string, string | number> = {
    allowed_formats: rule.formats,
    folder: rule.folder,
    timestamp: Math.floor(Date.now() / 1000),
  };
  const toSign = Object.keys(params)
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join("&");
  const signature = createHash("sha1").update(`${toSign}${apiSecret}`).digest("hex");

  return {
    uploadUrl: `https://api.cloudinary.com/v1_1/${cloudName}/${rule.resourceType}/upload`,
    fields: { ...params, api_key: apiKey, signature },
    maxBytes: rule.maxBytes,
  };
}

/** Admin API, Basic auth with the key pair. Server-only. */
function adminRequest(method: "GET" | "DELETE", path: string) {
  const auth = Buffer.from(`${env.CLOUDINARY_API_KEY}:${env.CLOUDINARY_API_SECRET}`).toString("base64");
  return fetch(`https://api.cloudinary.com/v1_1/${env.CLOUDINARY_CLOUD_NAME}${path}`, {
    method,
    headers: { authorization: `Basic ${auth}` },
    signal: AbortSignal.timeout(8000),
  });
}

const assetPath = (kind: MediaKind, publicId: string) =>
  `/resources/${MEDIA_RULES[kind].resourceType}/upload/${publicId.split("/").map(encodeURIComponent).join("/")}`;

/**
 * What Cloudinary itself holds for an upload — the size and URL the browser reported are
 * only claims. "missing" means there is no such asset; "unknown" means Cloudinary could
 * not be asked, and the caller decides how much to trust the browser instead.
 *
 * ponytail: one Admin API call per attachment. The free plan allows 500 an hour; verify
 * the upload response's own signature instead if attachments ever outrun that.
 */
export async function inspectAsset(
  kind: MediaKind,
  publicId: string,
): Promise<{ bytes: number; url: string } | "missing" | "unknown"> {
  try {
    const response = await adminRequest("GET", assetPath(kind, publicId));
    if (response.status === 404) return "missing";
    if (!response.ok) return "unknown";
    const body = await response.json();
    return { bytes: Number(body.bytes), url: String(body.secure_url) };
  } catch {
    return "unknown";
  }
}

export async function destroyAsset(kind: MediaKind, publicId: string): Promise<void> {
  // Deletion is by query on the collection, not by the per-asset path that GET uses.
  const collection = `/resources/${MEDIA_RULES[kind].resourceType}/upload`;
  await adminRequest("DELETE", `${collection}?public_ids[]=${encodeURIComponent(publicId)}`).catch(
    () => undefined,
  );
}
