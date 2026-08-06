import { NextResponse } from "next/server";
import { z } from "zod";
import { can } from "@/lib/auth/permissions";
import { getCurrentUser } from "@/lib/auth/require-user";
import { db } from "@/lib/db";
import { rateLimit } from "@/lib/ratelimit";

/**
 * Live chat between a citizen and the office.
 *
 * ponytail: a 5 s poll, not a socket — same reasoning as the notification bell. Vercel's
 * runtime has no websockets, and this is a handful of concurrent conversations at a
 * constituency office, not a messaging product.
 *
 * A citizen has exactly one thread; staff see all of them. The scoping is the `where`
 * clause on every query below.
 */

const forbidden = NextResponse.json(
  { error: { code: "FORBIDDEN", message: "Sign in first." } },
  { status: 403 },
);

const MESSAGE_SELECT = {
  id: true,
  body: true,
  createdAt: true,
  readAt: true,
  senderId: true,
  sender: { select: { name: true, role: true } },
} as const;

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return forbidden;

  const isStaff = can(user.role, "complaint.view_all");
  const requested = new URL(request.url).searchParams.get("threadId");

  if (isStaff) {
    const threads = await db.chatThread.findMany({
      where: { status: "OPEN" },
      select: {
        id: true,
        createdAt: true,
        citizen: { select: { id: true, name: true } },
        messages: { select: { body: true, createdAt: true }, orderBy: { createdAt: "desc" }, take: 1 },
        _count: { select: { messages: { where: { readAt: null, sender: { role: "CITIZEN" } } } } },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    const threadId = requested ?? threads[0]?.id ?? null;
    const messages = threadId
      ? await db.chatMessage.findMany({
          where: { threadId },
          select: MESSAGE_SELECT,
          orderBy: { createdAt: "asc" },
          take: 200,
        })
      : [];

    // Opening a thread marks the citizen's side read.
    if (threadId) {
      await db.chatMessage.updateMany({
        where: { threadId, readAt: null, senderId: { not: user.id } },
        data: { readAt: new Date() },
      });
    }

    return NextResponse.json({ data: { threads, threadId, messages } });
  }

  const thread = await db.chatThread.findFirst({
    where: { citizenId: user.id, status: "OPEN" },
    select: { id: true },
    orderBy: { createdAt: "desc" },
  });
  const messages = thread
    ? await db.chatMessage.findMany({
        where: { threadId: thread.id },
        select: MESSAGE_SELECT,
        orderBy: { createdAt: "asc" },
        take: 200,
      })
    : [];

  if (thread) {
    await db.chatMessage.updateMany({
      where: { threadId: thread.id, readAt: null, senderId: { not: user.id } },
      data: { readAt: new Date() },
    });
  }

  return NextResponse.json({ data: { threads: [], threadId: thread?.id ?? null, messages } });
}

const sendSchema = z.object({
  threadId: z.string().min(1).optional(),
  body: z.string().trim().min(1).max(2000),
});

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return forbidden;

  const limit = rateLimit(`chat-message:${user.id}`, 20, 60_000);
  if (!limit.ok) {
    return NextResponse.json(
      { error: { code: "RATE_LIMITED", message: "Slow down a moment." } },
      { status: 429, headers: { "retry-after": String(limit.retryAfterSeconds) } },
    );
  }

  const parsed = sendSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: "VALIDATION", message: "Write a message first." } },
      { status: 400 },
    );
  }

  const isStaff = can(user.role, "complaint.view_all");
  let threadId = parsed.data.threadId;

  if (isStaff) {
    if (!threadId) {
      return NextResponse.json(
        { error: { code: "VALIDATION", message: "Pick a conversation first." } },
        { status: 400 },
      );
    }
  } else {
    // A citizen writes into their own thread, creating it on the first message.
    const existing = await db.chatThread.findFirst({
      where: { citizenId: user.id, status: "OPEN" },
      select: { id: true },
    });
    threadId =
      existing?.id ??
      (await db.chatThread.create({ data: { citizenId: user.id }, select: { id: true } })).id;
  }

  const thread = await db.chatThread.findUnique({
    where: { id: threadId },
    select: { id: true, citizenId: true },
  });
  if (!thread || (!isStaff && thread.citizenId !== user.id)) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Conversation not found." } },
      { status: 404 },
    );
  }

  const message = await db.chatMessage.create({
    data: { threadId: thread.id, senderId: user.id, body: parsed.data.body },
    select: MESSAGE_SELECT,
  });

  return NextResponse.json({ data: { threadId: thread.id, message } });
}
