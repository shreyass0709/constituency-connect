"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn, formatDateTime } from "@/lib/utils";

type Message = {
  id: string;
  body: string;
  createdAt: string;
  senderId: string;
  sender: { name: string; role: string };
};

type Thread = {
  id: string;
  citizen: { id: string; name: string };
  messages: { body: string; createdAt: string }[];
  _count: { messages: number };
};

const POLL_MS = 5_000;

/**
 * One component for both sides. Staff get the thread list; a citizen has exactly one
 * conversation and never sees it. The poll is 5 s while the window has focus and pauses
 * when it does not — nobody needs a background tab hitting the database all afternoon.
 */
export function LiveChat({ viewerId, isStaff }: { viewerId: string; isStaff: boolean }) {
  const [threads, setThreads] = useState<Thread[]>([]);
  const [threadId, setThreadId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);
  const selected = useRef<string | null>(null);

  const load = useCallback(async () => {
    if (document.hidden) return;
    try {
      const query = selected.current ? `?threadId=${selected.current}` : "";
      const response = await fetch(`/api/v1/chat/threads${query}`, { cache: "no-store" });
      if (!response.ok) return;
      const { data } = await response.json();
      setThreads(data.threads);
      setMessages(data.messages);
      setThreadId(data.threadId);
      selected.current = data.threadId;
    } catch {
      // A blip; the next tick tries again.
    }
  }, []);

  useEffect(() => {
    void load();
    const timer = setInterval(load, POLL_MS);
    return () => clearInterval(timer);
    // `load` is stable, so this runs once — the initial fetch is intentional here
    // because there is nothing meaningful to render until it lands.
  }, [load]);

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight });
  }, [messages.length]);

  async function send(event: React.FormEvent) {
    event.preventDefault();
    const body = draft.trim();
    if (!body || sending) return;

    setSending(true);
    try {
      const response = await fetch("/api/v1/chat/threads", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ threadId: threadId ?? undefined, body }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error?.message ?? "Could not send that.");

      setDraft("");
      selected.current = payload.data.threadId;
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not send that.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className={cn("grid gap-4", isStaff && "lg:grid-cols-[18rem_1fr]")}>
      {isStaff ? (
        <ul className="flex max-h-[32rem] flex-col gap-1 overflow-y-auto rounded-2xl border p-2">
          {threads.length === 0 ? (
            <li className="p-4 text-sm text-muted-foreground">No conversations yet.</li>
          ) : (
            threads.map((thread) => (
              <li key={thread.id}>
                <button
                  type="button"
                  onClick={() => {
                    selected.current = thread.id;
                    setThreadId(thread.id);
                    void load();
                  }}
                  className={cn(
                    "flex w-full flex-col gap-0.5 rounded-xl p-3 text-left text-sm",
                    thread.id === threadId ? "bg-primary/10" : "hover:bg-muted",
                  )}
                >
                  <span className="flex items-center gap-2 font-medium">
                    {thread.citizen.name}
                    {thread._count.messages > 0 ? (
                      <span className="rounded-full bg-primary px-1.5 text-[0.65rem] text-primary-foreground">
                        {thread._count.messages}
                      </span>
                    ) : null}
                  </span>
                  <span className="line-clamp-1 text-xs text-muted-foreground">
                    {thread.messages[0]?.body ?? "No messages yet"}
                  </span>
                </button>
              </li>
            ))
          )}
        </ul>
      ) : null}

      <div className="flex h-[32rem] flex-col rounded-2xl border">
        <div
          ref={scroller}
          role="log"
          aria-live="polite"
          aria-label="Conversation"
          className="flex flex-1 flex-col gap-3 overflow-y-auto p-4"
        >
          {messages.length === 0 ? (
            <p className="m-auto max-w-xs text-center text-sm text-muted-foreground">
              {isStaff
                ? "Pick a conversation on the left."
                : "Ask the office anything. For a civic problem, raising a concern gets you a tracking code."}
            </p>
          ) : (
            messages.map((message) => (
              <div
                key={message.id}
                className={cn(
                  "flex max-w-[80%] flex-col gap-0.5 rounded-2xl px-3 py-2 text-sm",
                  message.senderId === viewerId
                    ? "self-end bg-primary text-primary-foreground"
                    : "self-start bg-muted",
                )}
              >
                <span className="whitespace-pre-wrap">{message.body}</span>
                <span
                  className={cn(
                    "text-[0.65rem]",
                    message.senderId === viewerId
                      ? "text-primary-foreground/70"
                      : "text-muted-foreground",
                  )}
                >
                  {message.sender.name} · {formatDateTime(message.createdAt)}
                </span>
              </div>
            ))
          )}
        </div>

        <form onSubmit={send} className="flex gap-2 border-t p-3">
          <Input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder={isStaff && !threadId ? "Pick a conversation first" : "Type a message"}
            aria-label="Message"
            maxLength={2000}
            disabled={isStaff && !threadId}
          />
          <Button type="submit" size="icon" aria-label="Send message" disabled={sending || (isStaff && !threadId)}>
            <Send />
          </Button>
        </form>
      </div>
    </div>
  );
}
