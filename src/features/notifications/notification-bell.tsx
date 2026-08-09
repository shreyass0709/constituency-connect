"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn, formatDateTime } from "@/lib/utils";

type Notification = {
  id: string;
  title: string;
  body: string;
  link: string | null;
  readAt: string | null;
  createdAt: string;
};

const POLL_MS = 30_000;

/**
 * ponytail: a 30 s poll, not a socket. Vercel's serverless runtime has no websockets and
 * SSE would be a whole connection story for a bell — the upgrade path is written down in
 * docs/06-roadmap.md and the day someone complains about the delay, it is one file.
 */
export function NotificationBell({ initialUnread }: { initialUnread: number }) {
  const t = useTranslations("notifications");
  const router = useRouter();
  const [items, setItems] = useState<Notification[]>([]);
  // Seeded by the server so the badge is right on first paint — the poll only keeps it
  // fresh, and the effect below never has to setState on mount.
  const [unread, setUnread] = useState(initialUnread);

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/v1/notifications", { cache: "no-store" });
      if (!response.ok) return;
      const { data } = await response.json();
      setItems(data.items);
      setUnread(data.unread);
    } catch {
      // Offline or a blip — the next tick tries again.
    }
  }, []);

  useEffect(() => {
    const timer = setInterval(load, POLL_MS);
    // Coming back to the tab should feel instant, not "up to 30 s stale".
    window.addEventListener("focus", load);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", load);
    };
  }, [load]);

  async function markRead(id?: string) {
    await fetch("/api/v1/notifications", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(id ? { id } : {}),
    });
    await load();
    router.refresh();
  }

  return (
    // The list itself is fetched when the bell is opened — no point pulling twenty rows
    // every 30 s for a badge.
    <DropdownMenu onOpenChange={(open) => open && load()}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          aria-label={unread > 0 ? t("bellUnread", { count: unread }) : t("bell")}
        >
          <Bell className="size-4" />
          {unread > 0 ? (
            <span className="absolute -right-0.5 -top-0.5 flex size-4 items-center justify-center rounded-full bg-primary text-[0.6rem] font-medium text-primary-foreground">
              {unread > 9 ? "9+" : unread}
            </span>
          ) : null}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel className="flex items-center justify-between">
          {t("bell")}
          {unread > 0 ? (
            <button
              type="button"
              onClick={() => markRead()}
              className="text-xs font-normal text-primary hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary rounded"
            >
              {t("markAllRead")}
            </button>
          ) : null}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {items.length === 0 ? (
          <p className="px-2 py-6 text-center text-sm text-muted-foreground">{t("empty")}</p>
        ) : (
          items.map((item) => (
            <DropdownMenuItem key={item.id} asChild className="flex-col items-start gap-0.5">
              <Link
                href={item.link ?? "/dashboard"}
                onClick={() => markRead(item.id)}
                className={cn("w-full", !item.readAt && "bg-primary/5")}
              >
                <span className="text-sm font-medium">{item.title}</span>
                <span className="line-clamp-2 text-xs text-muted-foreground">{item.body}</span>
                <span className="text-[0.65rem] text-muted-foreground">
                  {formatDateTime(item.createdAt)}
                </span>
              </Link>
            </DropdownMenuItem>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
