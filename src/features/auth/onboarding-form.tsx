"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { completeOnboarding } from "./actions";
import { LANGUAGES } from "./schemas";

export function OnboardingForm({
  defaultName,
  wards,
}: {
  defaultName: string;
  wards: { id: string; number: number; name: string }[];
}) {
  const router = useRouter();
  const [name, setName] = useState(defaultName);
  const [wardId, setWardId] = useState("");
  const [language, setLanguage] = useState<string>("en");
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    const result = await completeOnboarding({ name, wardId, language });
    setBusy(false);
    if (!result.ok) return toast.error(result.error);
    router.push("/after-login");
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <div className="grid gap-2">
        <Label htmlFor="name">Your name</Label>
        <Input
          id="name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          autoComplete="name"
          required
        />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="ward">Your ward</Label>
        <Select value={wardId} onValueChange={setWardId} required>
          <SelectTrigger id="ward" className="w-full">
            <SelectValue placeholder="Select your ward" />
          </SelectTrigger>
          <SelectContent>
            {wards.map((ward) => (
              <SelectItem key={ward.id} value={ward.id}>
                {ward.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="language">Preferred language</Label>
        <Select value={language} onValueChange={setLanguage}>
          <SelectTrigger id="language" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {LANGUAGES.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Button type="submit" disabled={busy}>
        {busy ? "Saving…" : "Continue"}
      </Button>
    </form>
  );
}
