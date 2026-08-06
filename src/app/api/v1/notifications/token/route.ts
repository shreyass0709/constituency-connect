import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/require-user";
import { db } from "@/lib/db";

const bodySchema = z.object({ token: z.string().min(20).max(500) });

/**
 * Device registration for web push. Called from the settings page once the browser has
 * granted permission, and by the service worker when FCM rotates a token.
 */
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json(
      { error: { code: "FORBIDDEN", message: "Sign in first." } },
      { status: 403 },
    );
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: "VALIDATION", message: "Missing device token." } },
      { status: 400 },
    );
  }

  const current = await db.user.findUniqueOrThrow({
    where: { id: user.id },
    select: { fcmTokens: true },
  });
  if (!current.fcmTokens.includes(parsed.data.token)) {
    await db.user.update({
      where: { id: user.id },
      // Keep the list short: a citizen with ten stale devices is ten wasted sends.
      data: { fcmTokens: [...current.fcmTokens, parsed.data.token].slice(-5) },
    });
  }

  return NextResponse.json({ data: { registered: true } });
}

/** Turning push off on this device, without touching the others. */
export async function DELETE(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json(
      { error: { code: "FORBIDDEN", message: "Sign in first." } },
      { status: 403 },
    );
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: "VALIDATION", message: "Missing device token." } },
      { status: 400 },
    );
  }

  const current = await db.user.findUniqueOrThrow({
    where: { id: user.id },
    select: { fcmTokens: true },
  });
  await db.user.update({
    where: { id: user.id },
    data: { fcmTokens: current.fcmTokens.filter((token) => token !== parsed.data.token) },
  });

  return NextResponse.json({ data: { registered: false } });
}
