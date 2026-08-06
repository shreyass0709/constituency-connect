"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { MessageSquarePlus, Send, Sparkles, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type Turn = { role: "user" | "assistant"; content: string };

/**
 * The public assistant. Streams plain text, keeps the whole exchange client-side, and
 * always leaves the real door — raising a concern — visible underneath it.
 */
export function ChatWidget() {
  const t = useTranslations("chat");
  const [open, setOpen] = useState(false);
  const [turns, setTurns] = useState<Turn[]>([{ role: "assistant", content: t("opener") }]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);

  async function send(event: React.FormEvent) {
    event.preventDefault();
    const question = draft.trim();
    if (!question || busy) return;

    const history: Turn[] = [...turns, { role: "user", content: question }];
    setTurns([...history, { role: "assistant", content: "" }]);
    setDraft("");
    setBusy(true);

    try {
      const response = await fetch("/api/v1/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ messages: history.filter((turn) => turn.content) }),
      });

      if (!response.ok || !response.body) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.error?.message ?? "The assistant is unavailable.");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let answer = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        answer += decoder.decode(value, { stream: true });
        setTurns([...history, { role: "assistant", content: answer }]);
        scroller.current?.scrollTo({ top: scroller.current.scrollHeight });
      }
    } catch (error) {
      setTurns([
        ...history,
        {
          role: "assistant",
          content:
            error instanceof Error
              ? error.message
              : t("failed"),
        },
      ]);
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <Button
        className="fixed bottom-4 right-4 z-20 rounded-full shadow-lg"
        onClick={() => setOpen(true)}
      >
        <Sparkles />
        {t("ask")}
      </Button>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 z-20 flex h-[28rem] w-[min(22rem,calc(100vw-2rem))] flex-col rounded-2xl border bg-background shadow-xl">
      <header className="flex items-center gap-2 border-b px-4 py-3">
        <Sparkles className="size-4 text-primary" aria-hidden />
        <span className="font-medium">{t("heading")}</span>
        <Button
          variant="ghost"
          size="icon"
          className="ml-auto size-7"
          aria-label={t("close")}
          onClick={() => setOpen(false)}
        >
          <X />
        </Button>
      </header>

      <div ref={scroller} className="flex flex-1 flex-col gap-3 overflow-y-auto p-4">
        {turns.map((turn, index) => (
          <p
            key={index}
            className={cn(
              "max-w-[85%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm",
              turn.role === "user"
                ? "self-end bg-primary text-primary-foreground"
                : "self-start bg-muted",
            )}
          >
            {turn.content || "…"}
          </p>
        ))}
      </div>

      <div className="border-t p-3">
        <form onSubmit={send} className="flex gap-2">
          <Input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder={t("placeholder")}
            aria-label={t("yourQuestion")}
            maxLength={2000}
          />
          <Button type="submit" size="icon" disabled={busy} aria-label={t("send")}>
            <Send />
          </Button>
        </form>
        <Button asChild variant="ghost" size="sm" className="mt-2 w-full">
          <Link href="/dashboard/raise">
            <MessageSquarePlus />
            Raise a concern instead
          </Link>
        </Button>
      </div>
    </div>
  );
}
