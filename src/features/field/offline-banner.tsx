"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { CloudOff, RefreshCw } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import {
  flushQueue,
  queuedCount,
  queuedCountOnServer,
  subscribeToQueue,
} from "./offline-queue";

/** `navigator.onLine` as an external store — no effect writing state on mount. */
function subscribeToConnection(listener: () => void) {
  window.addEventListener("online", listener);
  window.addEventListener("offline", listener);
  return () => {
    window.removeEventListener("online", listener);
    window.removeEventListener("offline", listener);
  };
}

/**
 * Tells the officer the truth about their connection and what is still unsent, and
 * drains the queue when the browser says the network is back.
 */
export function OfflineBanner() {
  const t = useTranslations("field.offline");
  const router = useRouter();

  const online = useSyncExternalStore(
    subscribeToConnection,
    () => navigator.onLine,
    () => true, // assume online while rendering on the server
  );
  const pending = useSyncExternalStore(subscribeToQueue, queuedCount, queuedCountOnServer);

  const drain = useCallback(async () => {
    const { sent, dropped } = await flushQueue();
    if (sent > 0) {
      toast.success(t("sent", { count: sent }));
      router.refresh();
    }
    if (dropped > 0) toast.warning(t("dropped", { count: dropped }));
  }, [router, t]);

  useEffect(() => {
    // Runs on mount for anything left from a previous session, and again on every
    // reconnection. `online` is the dependency that makes the second case happen.
    if (online) void drain();
  }, [online, drain]);

  if (online && pending === 0) return null;

  return (
    <p
      role="status"
      className="flex items-center gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm"
    >
      {online ? (
        <RefreshCw className="size-4 shrink-0 animate-spin" aria-hidden />
      ) : (
        <CloudOff className="size-4 shrink-0" aria-hidden />
      )}
      {online ? t("syncing") : t("offline")}
      {pending > 0 ? (
        <span className="text-muted-foreground">{t("waiting", { count: pending })}</span>
      ) : null}
    </p>
  );
}
