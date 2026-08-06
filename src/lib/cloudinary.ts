import { createHash } from "node:crypto";
import type { MediaKind } from "@/generated/prisma/enums";
import { env } from "./env";

/**
 * Signed direct-to-Cloudinary uploads: the browser never sees the API secret, and the
 * signature pins the folder and resource type the file may land in.
 *
 * Size is checked twice — in the browser before upload (fast feedback) and again in
 * `attachMedia` before the row is written. Cloudinary has no signable max-bytes param;
 * an upload preset with `max_file_size` is the upgrade if abuse ever appears.
 */

export const MEDIA_RULES: Record<
  MediaKind,
  { folder: string; resourceType: "image" | "video" | "raw"; maxBytes: number; accept: string }
> = {
  IMAGE: {
    folder: "constituency-connect/images",
    resourceType: "image",
    maxBytes: 10 * 1024 * 1024,
    accept: "image/jpeg,image/png,image/webp,image/heic",
  },
  VIDEO: {
    folder: "constituency-connect/videos",
    resourceType: "video",
    maxBytes: 100 * 1024 * 1024,
    accept: "video/mp4,video/quicktime,video/webm",
  },
  // Cloudinary serves audio through its video pipeline.
  AUDIO: {
    folder: "constituency-connect/audio",
    resourceType: "video",
    maxBytes: 20 * 1024 * 1024,
    accept: "audio/webm,audio/mpeg,audio/mp4,audio/ogg",
  },
  DOCUMENT: {
    folder: "constituency-connect/documents",
    resourceType: "raw",
    maxBytes: 10 * 1024 * 1024,
    accept: "application/pdf",
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
