import type { MediaKind } from "@/generated/prisma/enums";

/**
 * Signed direct upload: ask our server for a signature, POST the file straight to
 * Cloudinary, hand the result back for `attachMedia` to record. Shared by the citizen's
 * wizard and the field officer's proof capture — the bytes never touch our server either way.
 */
export async function uploadToCloudinary(file: Blob, kind: MediaKind, filename: string) {
  const signed = await fetch("/api/v1/uploads/sign", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ kind }),
  });
  const signedBody = await signed.json();
  if (!signed.ok) throw new Error(signedBody?.error?.message ?? "Uploads are unavailable.");

  const { uploadUrl, fields, maxBytes } = signedBody.data as {
    uploadUrl: string;
    fields: Record<string, string | number>;
    maxBytes: number;
  };
  if (file.size > maxBytes) {
    throw new Error(`That file is too large — the limit is ${Math.round(maxBytes / 1024 / 1024)} MB.`);
  }

  const form = new FormData();
  for (const [key, value] of Object.entries(fields)) form.append(key, String(value));
  form.append("file", file, filename);

  const upload = await fetch(uploadUrl, { method: "POST", body: form });
  const result = await upload.json();
  if (!upload.ok) throw new Error(result?.error?.message ?? "Upload failed. Try again.");

  return {
    url: result.secure_url as string,
    publicId: result.public_id as string,
    mimeType: (file.type || null) as string | null,
    sizeBytes: file.size,
  };
}
