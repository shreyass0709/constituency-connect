"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";

/** The code is what a citizen reads out on the phone — make it one tap to keep. */
export function CopyCode({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <Button
      variant="ghost"
      size="sm"
      className="font-mono"
      onClick={async () => {
        await navigator.clipboard.writeText(code);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
    >
      {copied ? <Check className="text-green-600" /> : <Copy />}
      {code}
      <span className="sr-only">{copied ? "Copied" : "Copy complaint code"}</span>
    </Button>
  );
}
