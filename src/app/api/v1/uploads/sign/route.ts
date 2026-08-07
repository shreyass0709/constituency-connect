import { NextResponse } from "next/server";
import { z } from "zod";
import { MediaKind } from "@/generated/prisma/enums";
import { getCurrentUser } from "@/lib/auth/require-user";
import { isCloudinaryConfigured, signUpload } from "@/lib/cloudinary";
import { limitOr429 } from "@/lib/ratelimit";

const bodySchema = z.object({ kind: z.enum(MediaKind) });

/** Hands the browser a one-shot signature so the file goes straight to Cloudinary. */
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json(
      { error: { code: "FORBIDDEN", message: "Sign in to upload files." } },
      { status: 403 },
    );
  }

  // Every other declared surface is metered (docs/02 §8) and this one was not: each
  // signature is permission to write into our Cloudinary account, and the signature
  // cannot itself cap bytes. 30/min is far above a wizard with a few photos.
  const limited = await limitOr429(
    `upload-sign:${user.id}`,
    30,
    60_000,
    "Too many uploads at once — give the last ones a moment to finish.",
  );
  if (limited) return limited;

  if (!isCloudinaryConfigured()) {
    return NextResponse.json(
      {
        error: {
          code: "INTERNAL",
          message: "File uploads are not configured on this deployment yet.",
        },
      },
      { status: 503 },
    );
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: "VALIDATION", message: "Unknown file kind." } },
      { status: 400 },
    );
  }

  return NextResponse.json({ data: signUpload(parsed.data.kind) });
}
