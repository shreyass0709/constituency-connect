import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/require-user";
import { db } from "@/lib/db";

const unauthorized = NextResponse.json(
  { error: { code: "FORBIDDEN", message: "Sign in first." } },
  { status: 403 },
);

/** The bell polls this every 30 s (docs/02-architecture.md §1 — no websockets at launch). */
export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return unauthorized;

  const cursor = new URL(request.url).searchParams.get("cursor");
  const items = await db.notification.findMany({
    where: { userId: user.id },
    select: { id: true, title: true, body: true, type: true, link: true, readAt: true, createdAt: true },
    orderBy: { createdAt: "desc" },
    take: 20,
    ...(cursor && { skip: 1, cursor: { id: cursor } }),
  });
  const unread = await db.notification.count({ where: { userId: user.id, readAt: null } });

  return NextResponse.json({
    data: { items, unread },
    meta: { nextCursor: items.length === 20 ? items[items.length - 1]!.id : null },
  });
}

const markSchema = z.object({ id: z.string().min(1).optional() });

/** Mark one notification read, or all of them when no id is given. */
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return unauthorized;

  const parsed = markSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: "VALIDATION", message: "Bad request." } },
      { status: 400 },
    );
  }

  const { count } = await db.notification.updateMany({
    // userId in the filter is what stops one citizen clearing another's bell.
    where: { userId: user.id, readAt: null, ...(parsed.data.id && { id: parsed.data.id }) },
    data: { readAt: new Date() },
  });

  return NextResponse.json({ data: { updated: count } });
}
