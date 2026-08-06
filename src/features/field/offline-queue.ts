"use client";

import { addWorkNote, advanceComplaint } from "@/features/complaints/actions";

/**
 * Offline-lite for field officers (docs/06-roadmap.md Phase 6). A ward with no signal
 * should not cost an officer the note they just typed: the mutation goes into
 * localStorage and replays, in order, the moment the browser reports it is back online.
 *
 * Only the two text-only mutations are queueable. `completeWork` deliberately is not —
 * it needs a proof photo, the photo needs a Cloudinary upload, and an upload needs the
 * network, so queuing it would create work that can never succeed. Completion stays a
 * live action that simply fails loudly while offline.
 *
 * ponytail: localStorage and one `online` listener, not a service worker with Background
 * Sync. Background Sync is Chromium-only, needs a service worker to own the replay, and
 * buys us nothing an officer who reopens the app does not already get. Revisit if
 * officers report losing notes while the tab is closed.
 */

const KEY = "cc.field.queue.v1";
const MAX = 50;

const HANDLERS = {
  workNote: (payload: { id: string; note: string }) => addWorkNote(payload),
  advance: (payload: { id: string; to: "DEPT_REVIEW" | "FIELD_VERIFICATION" | "IN_PROGRESS" }) =>
    advanceComplaint(payload),
} as const;

export type QueueableName = keyof typeof HANDLERS;

type Queued = {
  [K in QueueableName]: { id: string; name: K; payload: Parameters<(typeof HANDLERS)[K]>[0] };
}[QueueableName];

function read(): Queued[] {
  try {
    const raw = localStorage.getItem(KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as Queued[]) : [];
  } catch {
    // A corrupt queue must not brick the page — drop it and carry on.
    return [];
  }
}

function write(items: Queued[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(items.slice(-MAX)));
  } catch {
    // Private mode or a full quota: the live path still works, we just cannot buffer.
  }
  count = items.length;
  for (const listener of listeners) listener();
}

// A `useSyncExternalStore` source, so the banner can read the depth without an effect
// that writes state on mount. The cached count keeps getSnapshot referentially stable,
// which is what the hook requires.
let count = typeof window === "undefined" ? 0 : read().length;
const listeners = new Set<() => void>();

export function subscribeToQueue(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function queuedCount(): number {
  return count;
}

/** SSR has no localStorage, and an empty queue is the honest thing to render. */
export function queuedCountOnServer(): number {
  return 0;
}

function enqueue(item: Queued) {
  write([...read(), item]);
}

/**
 * Run the action now, or park it if the device is offline. `queued: true` means the
 * caller should tell the officer it will be sent later, not that it succeeded.
 */
export async function runOrQueue<K extends QueueableName>(
  name: K,
  payload: Parameters<(typeof HANDLERS)[K]>[0],
): Promise<{ queued: true } | { queued: false; error?: string }> {
  const item = { id: crypto.randomUUID(), name, payload } as Queued;

  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    enqueue(item);
    return { queued: true };
  }

  try {
    const result = await HANDLERS[name](payload as never);
    return result.ok ? { queued: false } : { queued: false, error: result.error };
  } catch {
    // A thrown call is a transport failure, not a rejected mutation: the server never
    // ran it, so replaying later is safe.
    enqueue(item);
    return { queued: true };
  }
}

/**
 * Replay everything, oldest first, stopping at the first transport failure so ordering
 * survives. A mutation the *server* rejects (already advanced, no longer assigned) is
 * dropped rather than retried forever — it will never succeed.
 */
export async function flushQueue(): Promise<{ sent: number; dropped: number; left: number }> {
  let pending = read();
  let sent = 0;
  let dropped = 0;

  while (pending.length > 0) {
    const [next, ...rest] = pending as [Queued, ...Queued[]];
    try {
      const result = await HANDLERS[next.name](next.payload as never);
      if (result.ok) sent += 1;
      else dropped += 1;
    } catch {
      break; // still offline — leave this one and everything after it in place
    }
    pending = rest;
    write(pending);
  }

  return { sent, dropped, left: pending.length };
}
