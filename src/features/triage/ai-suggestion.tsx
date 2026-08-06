"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, LoaderCircle, Merge, Sparkles, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { CATEGORY_LABEL, PRIORITY_LABEL } from "@/constants/status";
import { categorizeComplaint, mergeDuplicate } from "@/features/complaints/actions";
import { aiMetaOf } from "@/features/complaints/lib/ai-meta";
import type { ComplaintCard } from "@/features/complaints/queries";

/**
 * The one-click half of journey J2: the office reads a suggestion and either takes it or
 * ignores it. Nothing here is applied until someone presses a button — the AI proposes,
 * the office decides.
 */
export function AiSuggestion({ complaint }: { complaint: ComplaintCard }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const meta = aiMetaOf(complaint.aiMeta);

  if (!meta) {
    return (
      <p className="flex items-center gap-2 rounded-xl bg-muted px-3 py-2 text-xs text-muted-foreground">
        <TriangleAlert className="size-3.5" aria-hidden />
        Not tagged automatically — categorise it by hand.
      </p>
    );
  }

  if (meta.status === "failed") {
    return (
      <p className="flex items-center gap-2 rounded-xl bg-muted px-3 py-2 text-xs text-muted-foreground">
        <TriangleAlert className="size-3.5" aria-hidden />
        {meta.summary ?? "Automatic tagging did not run"} — categorise it by hand.
      </p>
    );
  }

  const { suggestedCategory, suggestedPriority, confidence } = meta;

  async function accept() {
    if (!suggestedCategory || !suggestedPriority) return;
    setBusy(true);
    const result = await categorizeComplaint({
      id: complaint.id,
      category: suggestedCategory,
      priority: suggestedPriority,
      departmentId: meta?.suggestedDepartmentId ?? null,
    });
    setBusy(false);
    if (!result.ok) return toast.error(result.error);
    toast.success("Applied.");
    router.refresh();
  }

  async function merge() {
    if (!meta?.duplicate) return;
    setBusy(true);
    const result = await mergeDuplicate({ id: complaint.id, originalCode: meta.duplicate.code });
    setBusy(false);
    if (!result.ok) return toast.error(result.error);
    toast.success(`Merged into ${meta.duplicate.code}.`);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-2">
      {suggestedCategory && suggestedPriority ? (
        <div className="flex flex-wrap items-center gap-2 rounded-xl bg-primary/5 px-3 py-2 text-xs">
          <Sparkles className="size-3.5 text-primary" aria-hidden />
          <span className="font-medium">
            {CATEGORY_LABEL[suggestedCategory]} · {PRIORITY_LABEL[suggestedPriority]}
            {meta.suggestedDepartmentName ? ` · ${meta.suggestedDepartmentName}` : ""}
          </span>
          {typeof confidence === "number" ? (
            <span className="text-muted-foreground">{Math.round(confidence * 100)}% sure</span>
          ) : null}
          {meta.summary ? (
            <span className="w-full text-muted-foreground sm:w-auto">“{meta.summary}”</span>
          ) : null}
          <Button size="sm" variant="ghost" className="ml-auto h-7" disabled={busy} onClick={accept}>
            {busy ? <LoaderCircle className="animate-spin" /> : <Check />}
            Accept
          </Button>
        </div>
      ) : null}

      {meta.duplicate ? (
        <div className="flex flex-wrap items-center gap-2 rounded-xl bg-amber-500/10 px-3 py-2 text-xs">
          <TriangleAlert className="size-3.5 text-amber-600 dark:text-amber-400" aria-hidden />
          <span>
            Possibly the same as{" "}
            <span className="font-mono font-medium">{meta.duplicate.code}</span> — {meta.duplicate.reason}
          </span>
          <Button size="sm" variant="ghost" className="ml-auto h-7" disabled={busy} onClick={merge}>
            <Merge />
            Merge
          </Button>
        </div>
      ) : null}
    </div>
  );
}
