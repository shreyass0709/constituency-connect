import { NextResponse } from "next/server";
import { z } from "zod";
import { MediaKind } from "@/generated/prisma/enums";
import { getCurrentUser } from "@/lib/auth/require-user";
import { isCloudinaryConfigured, signUpload } from "@/lib/cloudinary";

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
