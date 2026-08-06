"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle, Save } from "lucide-react";
import { toast } from "sonner";
import type { RepresentativeType } from "@/generated/prisma/enums";
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
import { Textarea } from "@/components/ui/textarea";
import { updateRepresentativeProfile } from "./actions";

const TYPES: RepresentativeType[] = ["MLA", "MP", "COUNCILLOR"];

export type ProfileValues = {
  name: string;
  type: RepresentativeType;
  constituencyName: string;
  party: string | null;
  photo: string | null;
  bio: string;
  vision: string;
  contactEmail: string | null;
  contactPhone: string | null;
  officeAddress: string | null;
  officeHours: string | null;
};

/** What the public About and Contact pages read from. One row, one form. */
export function ProfileForm({ initial }: { initial: ProfileValues }) {
  const router = useRouter();
  const [values, setValues] = useState(initial);
  const [busy, setBusy] = useState(false);

  const set = <K extends keyof ProfileValues>(key: K, value: ProfileValues[K]) =>
    setValues((current) => ({ ...current, [key]: value }));

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    const result = await updateRepresentativeProfile(values);
    setBusy(false);
    if (!result.ok) return toast.error(result.error);
    toast.success("Profile updated — the public pages will show it within a few minutes.");
    router.refresh();
  }

  return (
    <form onSubmit={save} className="flex flex-col gap-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name" id="name">
          <Input
            id="name"
            value={values.name}
            onChange={(event) => set("name", event.target.value)}
            required
          />
        </Field>

        <Field label="Office" id="type">
          <Select
            value={values.type}
            onValueChange={(value) => set("type", value as RepresentativeType)}
          >
            <SelectTrigger id="type" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TYPES.map((type) => (
                <SelectItem key={type} value={type}>
                  {type}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <Field label="Constituency" id="constituency">
          <Input
            id="constituency"
            value={values.constituencyName}
            onChange={(event) => set("constituencyName", event.target.value)}
            required
          />
        </Field>

        <Field label="Party (optional)" id="party">
          <Input
            id="party"
            value={values.party ?? ""}
            onChange={(event) => set("party", event.target.value || null)}
          />
        </Field>

        <Field label="Photo URL (optional)" id="photo">
          <Input
            id="photo"
            value={values.photo ?? ""}
            onChange={(event) => set("photo", event.target.value || null)}
          />
        </Field>

        <Field label="Office hours" id="hours">
          <Input
            id="hours"
            value={values.officeHours ?? ""}
            onChange={(event) => set("officeHours", event.target.value || null)}
            placeholder="Mon–Sat, 10:00–17:00"
          />
        </Field>

        <Field label="Contact email" id="email">
          <Input
            id="email"
            type="email"
            value={values.contactEmail ?? ""}
            onChange={(event) => set("contactEmail", event.target.value || null)}
          />
        </Field>

        <Field label="Contact phone" id="phone">
          <Input
            id="phone"
            value={values.contactPhone ?? ""}
            onChange={(event) => set("contactPhone", event.target.value || null)}
          />
        </Field>
      </div>

      <Field label="Office address" id="address">
        <Textarea
          id="address"
          rows={2}
          value={values.officeAddress ?? ""}
          onChange={(event) => set("officeAddress", event.target.value || null)}
        />
      </Field>

      <Field label="Biography" id="bio">
        <Textarea
          id="bio"
          rows={5}
          value={values.bio}
          onChange={(event) => set("bio", event.target.value)}
          required
        />
      </Field>

      <Field label="Vision" id="vision">
        <Textarea
          id="vision"
          rows={4}
          value={values.vision}
          onChange={(event) => set("vision", event.target.value)}
          required
        />
      </Field>

      <Button type="submit" className="w-fit" disabled={busy}>
        {busy ? <LoaderCircle className="animate-spin" /> : <Save />}
        Save profile
      </Button>
    </form>
  );
}

function Field({
  label,
  id,
  children,
}: {
  label: string;
  id: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{label}</Label>
      {children}
    </div>
  );
}
