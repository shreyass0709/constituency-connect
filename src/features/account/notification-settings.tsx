"use client";

import { useState } from "react";
import { Bell, BellOff, LoaderCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { NotificationPrefs } from "@/lib/notify/prefs";
import { updateNotificationPrefs } from "./actions";

/**
 * The in-app bell is not on this page on purpose: it is the record of what happened, not
 * a channel a user can silence.
 */
export function NotificationSettings({
  initial,
  pushConfigured,
}: {
  initial: NotificationPrefs;
  pushConfigured: boolean;
}) {
  const [prefs, setPrefs] = useState(initial);
  const [busy, setBusy] = useState(false);

  async function save(next: NotificationPrefs) {
    const previous = prefs;
    setPrefs(next);
    setBusy(true);
    const result = await updateNotificationPrefs(next);
    setBusy(false);
    if (!result.ok) {
      setPrefs(previous);
      toast.error(result.error);
      return;
    }
    toast.success("Saved.");
  }

  return (
    <div className="flex flex-col gap-4">
      <Toggle
        id="pref-push"
        label="Push notifications"
        description="A notification on your phone or desktop when a concern moves."
        checked={prefs.push}
        disabled={busy}
        onChange={(push) => save({ ...prefs, push })}
      />
      <Toggle
        id="pref-email"
        label="Email"
        description="The same updates by email, for when you are away from the app."
        checked={prefs.email}
        disabled={busy}
        onChange={(email) => save({ ...prefs, email })}
      />

      {prefs.push ? (
        pushConfigured ? (
          <EnablePushOnThisDevice />
        ) : (
          <p className="rounded-xl bg-muted p-3 text-sm text-muted-foreground">
            Push is not configured on this deployment yet, so these updates arrive in the
            bell and by email.
          </p>
        )
      ) : null}
    </div>
  );
}

function Toggle({
  id,
  label,
  description,
  checked,
  disabled,
  onChange,
}: {
  id: string;
  label: string;
  description: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label htmlFor={id} className="flex items-start gap-3 rounded-2xl border p-4">
      <input
        id={id}
        type="checkbox"
        className="mt-1 size-4 accent-primary"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span className="flex flex-col gap-0.5">
        <span className="font-medium">{label}</span>
        <span className="text-sm text-muted-foreground">{description}</span>
      </span>
    </label>
  );
}

/** Asks the browser for permission, mints an FCM token, and registers it to this user. */
function EnablePushOnThisDevice() {
  const [state, setState] = useState<"idle" | "working" | "on">("idle");

  async function enable() {
    setState("working");
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") throw new Error("Notifications are blocked in this browser.");

      const registration = await navigator.serviceWorker.register("/firebase-messaging-sw.js");
      // Loaded on demand: the Firebase SDK has no business in the main bundle.
      const [{ initializeApp }, { getMessaging, getToken }] = await Promise.all([
        import("firebase/app"),
        import("firebase/messaging"),
      ]);
      const app = initializeApp({
        apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY!,
        projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!,
        messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID!,
        appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID!,
      });
      const token = await getToken(getMessaging(app), {
        vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY,
        serviceWorkerRegistration: registration,
      });
      if (!token) throw new Error("This browser would not give us a device token.");

      const response = await fetch("/api/v1/notifications/token", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token }),
      });
      if (!response.ok) throw new Error("Could not register this device.");

      setState("on");
      toast.success("Push is on for this device.");
    } catch (error) {
      setState("idle");
      toast.error(error instanceof Error ? error.message : "Could not turn on push here.");
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-dashed p-4">
      <div className="flex-1">
        <p className="font-medium">This device</p>
        <p className="text-sm text-muted-foreground">
          Each phone or browser has to be allowed once.
        </p>
      </div>
      <Button variant="outline" onClick={enable} disabled={state !== "idle"}>
        {state === "working" ? (
          <LoaderCircle className="animate-spin" />
        ) : state === "on" ? (
          <Bell />
        ) : (
          <BellOff />
        )}
        {state === "on" ? "Enabled" : "Enable on this device"}
      </Button>
    </div>
  );
}
