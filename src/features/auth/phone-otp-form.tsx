"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth/client";

/**
 * Phone → OTP → session. Bare digits are assumed Indian (+91); anything typed with a
 * country code is left alone. The server re-validates — this is UX only.
 */
export function toE164(input: string): string | null {
  const digits = input.replace(/[^\d]/g, "");
  if (input.trim().startsWith("+")) return digits.length >= 10 ? `+${digits}` : null;
  if (digits.length === 10) return `+91${digits}`;
  return null;
}

export function PhoneOtpForm({
  next,
  demoAccounts = [],
}: {
  next?: string;
  /** Only passed in demo sign-in mode (DEMO_OTP): tapping one fills in its number. */
  demoAccounts?: { label: string; phone: string }[];
}) {
  const t = useTranslations("auth");
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  async function sendOtp(event: React.FormEvent) {
    event.preventDefault();
    const phoneNumber = toE164(phone);
    if (!phoneNumber) return toast.error(t("errors.phone"));

    setBusy(true);
    const { error } = await authClient.phoneNumber.sendOtp({ phoneNumber });
    setBusy(false);
    if (error) return toast.error(error.message ?? t("errors.sendFailed"));
    setSentTo(phoneNumber);
    toast.success(t("codeSent", { phone: phoneNumber }));
  }

  async function verify(otp: string) {
    if (!sentTo) return;
    setBusy(true);
    const { error } = await authClient.phoneNumber.verify({ phoneNumber: sentTo, code: otp });
    setBusy(false);
    if (error) {
      setCode("");
      return toast.error(error.message ?? t("errors.badCode"));
    }
    router.push(next ?? "/after-login");
  }

  if (!sentTo) {
    return (
      <form onSubmit={sendOtp} className="flex flex-col gap-4">
        <div className="grid gap-2">
          <Label htmlFor="phone">{t("mobileNumber")}</Label>
          <Input
            id="phone"
            name="phone"
            type="tel"
            autoComplete="tel"
            inputMode="tel"
            placeholder="98765 43210"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            required
          />
        </div>
        <Button type="submit" disabled={busy}>
          {busy ? t("sending") : t("sendCode")}
        </Button>
        {demoAccounts.length ? (
          <div className="grid gap-2 border-t pt-4">
            <p className="text-xs text-muted-foreground">{t("demoAccounts")}</p>
            <div className="flex flex-wrap gap-2">
              {demoAccounts.map((account) => (
                <Button
                  key={account.phone}
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setPhone(account.phone)}
                >
                  {account.label} · {account.phone.replace(/^\+91/, "")}
                </Button>
              ))}
            </div>
          </div>
        ) : null}
      </form>
    );
  }

  return (
    <div className="flex flex-col items-center gap-4">
      <Label htmlFor="otp">{t("enterCode", { phone: sentTo })}</Label>
      <InputOTP
        id="otp"
        autoFocus
        maxLength={6}
        value={code}
        disabled={busy}
        onChange={(value) => {
          setCode(value);
          if (value.length === 6) void verify(value);
        }}
      >
        <InputOTPGroup>
          {[0, 1, 2, 3, 4, 5].map((index) => (
            <InputOTPSlot key={index} index={index} />
          ))}
        </InputOTPGroup>
      </InputOTP>
      <Button
        variant="ghost"
        size="sm"
        disabled={busy}
        onClick={() => {
          setSentTo(null);
          setCode("");
        }}
      >
        {t("differentNumber")}
      </Button>
    </div>
  );
}
