"use client";

import { useState } from "react";
import { LoaderCircle, ShieldOff } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth/client";

/**
 * "Sign out everywhere else" — the control docs/02 §8 asks for against session theft.
 * A citizen who used a shared phone at a cyber café needs a way to end that session from
 * their own, and a staff member who lost a device needs it more.
 *
 * Revokes the *other* sessions, not this one: signing yourself out as a side effect of
 * securing your account is a confusing way to be told it worked.
 */
export function RevokeSessions() {
  const t = useTranslations("settings.sessions");
  const [busy, setBusy] = useState(false);

  return (
    <section className="flex flex-col gap-2 rounded-2xl border p-4">
      <h2 className="font-medium">{t("heading")}</h2>
      <p className="text-sm text-muted-foreground">{t("hint")}</p>
      <Button
        variant="outline"
        className="w-fit"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          const { error } = await authClient.revokeOtherSessions();
          setBusy(false);
          if (error) return toast.error(error.message ?? t("failed"));
          toast.success(t("done"));
        }}
      >
        {busy ? <LoaderCircle className="animate-spin" /> : <ShieldOff />}
        {t("action")}
      </Button>
    </section>
  );
}
