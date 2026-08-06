"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CircleCheckBig, LoaderCircle, Play, Send, Sparkles } from "lucide-react";
import { toast } from "sonner";
import type { ComplaintStatus } from "@/generated/prisma/enums";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { addWorkNote, advanceComplaint, completeWork } from "@/features/complaints/actions";
import { suggestResponse } from "@/features/complaints/ai-actions";
import { ProofCapture } from "./proof-capture";
import { SignaturePad } from "./signature-pad";

/**
 * The on-site flow (journey J3), top to bottom in the order an officer actually works:
 * start → notes and proof → complete with a signature.
 */
export function TaskActions({
  complaintId,
  status,
  proof,
}: {
  complaintId: string;
  status: ComplaintStatus;
  proof: { id: string; url: string }[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const [completionNote, setCompletionNote] = useState("");
  const [signatureMediaId, setSignatureMediaId] = useState<string | null>(null);

  const working = status === "IN_PROGRESS";
  const canStart = status === "ASSIGNED" || status === "DEPT_REVIEW" || status === "FIELD_VERIFICATION" || status === "REOPENED";

  async function start() {
    setBusy(true);
    const result = await advanceComplaint({ id: complaintId, to: "IN_PROGRESS" });
    setBusy(false);
    if (!result.ok) return toast.error(result.error);
    toast.success("Work started. The citizen has been told.");
    router.refresh();
  }

  async function saveNote() {
    setBusy(true);
    const result = await addWorkNote({ id: complaintId, note });
    setBusy(false);
    if (!result.ok) return toast.error(result.error);
    setNote("");
    toast.success("Note added.");
    router.refresh();
  }

  async function draftReply() {
    setBusy(true);
    const result = await suggestResponse({ id: complaintId });
    setBusy(false);
    if (!result.ok) return toast.message(result.error);
    setNote(result.data.draft);
  }

  async function complete() {
    setBusy(true);
    const result = await completeWork({
      id: complaintId,
      note: completionNote || undefined,
      signatureMediaId,
    });
    setBusy(false);
    if (!result.ok) return toast.error(result.error);
    toast.success("Marked complete. The citizen has 7 days to confirm.");
    router.refresh();
  }

  if (!canStart && !working) return null;

  return (
    <div className="flex flex-col gap-6 rounded-2xl border p-4">
      {canStart ? (
        <Button onClick={start} disabled={busy} size="lg">
          {busy ? <LoaderCircle className="animate-spin" /> : <Play />}
          Start work
        </Button>
      ) : null}

      {working ? (
        <>
          <div className="flex flex-col gap-2">
            <Label>Proof of work</Label>
            <ProofCapture complaintId={complaintId} initial={proof} />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="work-note">Work note</Label>
            <Textarea
              id="work-note"
              rows={3}
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="What you found, what you did, what is left."
            />
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={busy || note.trim().length < 3}
                onClick={saveNote}
              >
                <Send />
                Add note
              </Button>
              {/* A draft to edit, never an auto-reply — the officer sends what they mean. */}
              <Button variant="ghost" size="sm" disabled={busy} onClick={draftReply}>
                {busy ? <LoaderCircle className="animate-spin" /> : <Sparkles />}
                Draft it for me
              </Button>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="completion-note">Finish up</Label>
            <Textarea
              id="completion-note"
              rows={2}
              value={completionNote}
              onChange={(event) => setCompletionNote(event.target.value)}
              placeholder="Summary the citizen will read (optional)."
            />
            <SignaturePad complaintId={complaintId} onSigned={setSignatureMediaId} />
            <Button onClick={complete} disabled={busy} size="lg">
              {busy ? <LoaderCircle className="animate-spin" /> : <CircleCheckBig />}
              Mark completed
            </Button>
            <p className="text-xs text-muted-foreground">
              At least one proof photo is required. The signature is optional.
            </p>
          </div>
        </>
      ) : null}
    </div>
  );
}
