import { beforeEach, describe, expect, it, vi } from "vitest";

// The module imports server actions, which cannot run under vitest — stub them and drive
// the queue through the stubs. This is the only way to exercise "offline" without a phone.
const addWorkNote = vi.fn();
const advanceComplaint = vi.fn();

vi.mock("@/features/complaints/actions", () => ({
  addWorkNote: (input: unknown) => addWorkNote(input),
  advanceComplaint: (input: unknown) => advanceComplaint(input),
  completeWork: vi.fn(),
}));

const store = new Map<string, string>();
vi.stubGlobal("localStorage", {
  getItem: (key: string) => store.get(key) ?? null,
  setItem: (key: string, value: string) => void store.set(key, value),
  removeItem: (key: string) => void store.delete(key),
});
vi.stubGlobal("crypto", { randomUUID: () => Math.random().toString(36).slice(2) });

const online = { value: true };
vi.stubGlobal("navigator", { get onLine() { return online.value; } });

const { flushQueue, queuedCount, runOrQueue } = await import("./offline-queue");

beforeEach(() => {
  store.clear();
  online.value = true;
  addWorkNote.mockReset();
  advanceComplaint.mockReset();
});

describe("field offline queue", () => {
  it("sends straight through when the phone is online", async () => {
    addWorkNote.mockResolvedValue({ ok: true, data: { id: "c1" } });

    expect(await runOrQueue("workNote", { id: "c1", note: "Fixed the pipe" })).toEqual({
      queued: false,
    });
    expect(addWorkNote).toHaveBeenCalledOnce();
    expect(queuedCount()).toBe(0);
  });

  it("parks the mutation when the phone is offline and never calls the server", async () => {
    online.value = false;

    expect(await runOrQueue("workNote", { id: "c1", note: "No signal here" })).toEqual({
      queued: true,
    });
    expect(addWorkNote).not.toHaveBeenCalled();
    expect(queuedCount()).toBe(1);
  });

  it("parks it when the call throws — a transport failure means the server never ran it", async () => {
    addWorkNote.mockRejectedValue(new Error("Failed to fetch"));

    expect(await runOrQueue("workNote", { id: "c1", note: "Sent into a void" })).toEqual({
      queued: true,
    });
    expect(queuedCount()).toBe(1);
  });

  it("replays in the order the officer worked", async () => {
    online.value = false;
    await runOrQueue("advance", { id: "c1", to: "IN_PROGRESS" });
    await runOrQueue("workNote", { id: "c1", note: "first" });
    await runOrQueue("workNote", { id: "c1", note: "second" });

    online.value = true;
    advanceComplaint.mockResolvedValue({ ok: true, data: {} });
    addWorkNote.mockResolvedValue({ ok: true, data: {} });

    expect(await flushQueue()).toEqual({ sent: 3, dropped: 0, left: 0 });
    expect(addWorkNote.mock.calls.map(([input]) => (input as { note: string }).note)).toEqual([
      "first",
      "second",
    ]);
    expect(queuedCount()).toBe(0);
  });

  it("drops what the server rejects instead of retrying it forever", async () => {
    online.value = false;
    await runOrQueue("advance", { id: "c1", to: "IN_PROGRESS" });
    online.value = true;
    advanceComplaint.mockResolvedValue({ ok: false, error: "Cannot move from CLOSED." });

    expect(await flushQueue()).toEqual({ sent: 0, dropped: 1, left: 0 });
    expect(queuedCount()).toBe(0);
  });

  it("stops at the first transport failure so nothing is sent out of order", async () => {
    online.value = false;
    await runOrQueue("workNote", { id: "c1", note: "first" });
    await runOrQueue("workNote", { id: "c1", note: "second" });

    online.value = true;
    addWorkNote
      .mockResolvedValueOnce({ ok: true, data: {} })
      .mockRejectedValueOnce(new Error("Failed to fetch"));

    expect(await flushQueue()).toEqual({ sent: 1, dropped: 0, left: 1 });
    expect(queuedCount()).toBe(1);
  });

  it("survives a corrupt queue rather than bricking the page", async () => {
    store.set("cc.field.queue.v1", "{not json");
    online.value = true;
    await expect(flushQueue()).resolves.toEqual({ sent: 0, dropped: 0, left: 0 });
  });
});
