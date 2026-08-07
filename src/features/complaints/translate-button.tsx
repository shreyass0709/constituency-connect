"use client";

import { useState } from "react";
import { Languages, LoaderCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { LANGUAGES } from "@/constants/languages";
import { translateComplaint } from "./ai-actions";

/**
 * On-demand translation for the reader who did not write the complaint — an officer
 * facing Hindi, or a citizen reading an English reply. The original is never replaced;
 * the translation appears beside it and can be dismissed.
 */
export function TranslateButton({
  complaintId,
  currentLanguage,
  viewerLanguage,
}: {
  complaintId: string;
  currentLanguage: string | null;
  viewerLanguage: string;
}) {
  const [busy, setBusy] = useState(false);
  const [translated, setTranslated] = useState<{ title: string; description: string } | null>(null);

  // Nothing to offer when it is already in the reader's language.
  if (currentLanguage && currentLanguage === viewerLanguage) return null;

  const target = LANGUAGES.find((language) => language.value === viewerLanguage);

  async function translate() {
    setBusy(true);
    const result = await translateComplaint({ id: complaintId, language: viewerLanguage });
    setBusy(false);
    if (!result.ok) return toast.message(result.error);
    setTranslated(result.data);
  }

  return (
    <div className="flex flex-col gap-2">
      <Button
        variant="ghost"
        size="sm"
        className="w-fit"
        disabled={busy}
        onClick={() => (translated ? setTranslated(null) : translate())}
      >
        {busy ? <LoaderCircle className="animate-spin" /> : <Languages />}
        {translated ? "Show the original" : `Translate to ${target?.label ?? viewerLanguage}`}
      </Button>

      {translated ? (
        <div className="flex flex-col gap-1 rounded-2xl border border-dashed p-4">
          <p className="font-medium">{translated.title}</p>
          <p className="whitespace-pre-wrap text-sm text-muted-foreground">
            {translated.description}
          </p>
          <p className="text-xs text-muted-foreground">Machine translation — the original stands.</p>
        </div>
      ) : null}
    </div>
  );
}
