import { NextResponse } from "next/server";
import { z } from "zod";
import { streamChatReply } from "@/lib/ai/chat";
import { aiEnabled } from "@/lib/ai/gemini";
import { getCurrentUser } from "@/lib/auth/require-user";
import { db } from "@/lib/db";
import { rateLimit } from "@/lib/ratelimit";

const bodySchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().trim().min(1).max(2000),
      }),
    )
    .min(1)
    .max(20),
});

/** Public — no sign-in needed, so the limiter keys on the caller's IP when anonymous. */
export async function POST(request: Request) {
  if (!aiEnabled()) {
    return NextResponse.json(
      {
        error: {
          code: "INTERNAL",
          message: "The assistant is not available. The FAQ page has the same answers.",
        },
      },
      { status: 503 },
    );
  }

  const user = await getCurrentUser();
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "anonymous";
  const limit = rateLimit(`chat:${user?.id ?? ip}`, 10, 60_000);
  if (!limit.ok) {
    return NextResponse.json(
      { error: { code: "RATE_LIMITED", message: "One moment — too many questions at once." } },
      { status: 429, headers: { "retry-after": String(limit.retryAfterSeconds) } },
    );
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: "VALIDATION", message: "That message could not be read." } },
      { status: 400 },
    );
  }

  const [representative, faqs, schemes] = await Promise.all([
    db.representative.findFirst({
      select: { name: true, constituencyName: true, officeHours: true },
    }),
    db.faq.findMany({ select: { question: true, answer: true }, orderBy: { sortOrder: "asc" } }),
    db.scheme.findMany({
      where: { isActive: true },
      select: { title: true, summary: true, eligibility: true },
      take: 25,
    }),
  ]);

  const stream = await streamChatReply({
    history: parsed.data.messages,
    grounding: { representative, faqs, schemes },
  });
  if (!stream) {
    return NextResponse.json(
      { error: { code: "INTERNAL", message: "The assistant could not answer just now." } },
      { status: 503 },
    );
  }

  return new Response(stream, {
    headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" },
  });
}
