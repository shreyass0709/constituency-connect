"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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

export function PhoneOtpForm({ next }: { next?: string }) {
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  async function sendOtp(event: React.FormEvent) {
    event.preventDefault();
    const phoneNumber = toE164(phone);
    if (!phoneNumber) return toast.error("Enter a valid 10-digit mobile number.");

    setBusy(true);
    const { error } = await authClient.phoneNumber.sendOtp({ phoneNumber });
    setBusy(false);
    if (error) return toast.error(error.message ?? "Could not send the code. Try again.");
    setSentTo(phoneNumber);
    toast.success(`Code sent to ${phoneNumber}`);
  }

  async function verify(otp: string) {
    if (!sentTo) return;
    setBusy(true);
    const { error } = await authClient.phoneNumber.verify({ phoneNumber: sentTo, code: otp });
    setBusy(false);
    if (error) {
      setCode("");
      return toast.error(error.message ?? "That code didn't work. Try again.");
    }
    router.push(next ?? "/after-login");
  }

  if (!sentTo) {
    return (
      <form onSubmit={sendOtp} className="flex flex-col gap-4">
        <div className="grid gap-2">
          <Label htmlFor="phone">Mobile number</Label>
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
          {busy ? "Sending…" : "Send code"}
        </Button>
      </form>
    );
  }

  return (
    <div className="flex flex-col items-center gap-4">
      <Label htmlFor="otp">Enter the code sent to {sentTo}</Label>
      <InputOTP
        id="otp"
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
        Use a different number
      </Button>
    </div>
  );
}
