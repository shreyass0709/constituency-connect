"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Check, ChevronLeft, LoaderCircle, Locate, Send } from "lucide-react";
import { toast } from "sonner";
import type { ComplaintCategory } from "@/generated/prisma/enums";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CATEGORIES, CATEGORY_ICON, CATEGORY_LABEL } from "@/constants/status";
import { cn } from "@/lib/utils";
import { saveDraft, submitComplaint } from "./actions";
import { MediaUploader, type AttachedMedia } from "./media-uploader";

type Draft = {
  id: string;
  title: string;
  description: string;
  category: ComplaintCategory | null;
  latitude: number | null;
  longitude: number | null;
  address: string | null;
  landmark: string | null;
  media: AttachedMedia[];
};

const STEPS = ["What", "Where", "Review"] as const;

export function RaiseWizard({ draft, homeWard }: { draft: Draft | null; homeWard: string | null }) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [id, setId] = useState<string | null>(draft?.id ?? null);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  const [category, setCategory] = useState<ComplaintCategory | null>(draft?.category ?? null);
  const [title, setTitle] = useState(draft?.title ?? "");
  const [description, setDescription] = useState(draft?.description ?? "");
  const [latitude, setLatitude] = useState<number | null>(draft?.latitude ?? null);
  const [longitude, setLongitude] = useState<number | null>(draft?.longitude ?? null);
  const [address, setAddress] = useState(draft?.address ?? "");
  const [landmark, setLandmark] = useState(draft?.landmark ?? "");

  /** One save call for every step change — the draft row is the autosave. */
  async function persist(overrides: Partial<Draft> = {}) {
    const result = await saveDraft({
      id: id ?? undefined,
      title: overrides.title ?? title,
      description: overrides.description ?? description,
      category: (overrides.category ?? category) ?? undefined,
      latitude: overrides.latitude ?? latitude,
      longitude: overrides.longitude ?? longitude,
      address: overrides.address ?? address,
      landmark: overrides.landmark ?? landmark,
    });
    if (!result.ok) {
      toast.error(result.error);
      return null;
    }
    setId(result.data.id);
    setSaved(true);
    return result.data.id;
  }

  async function next() {
    if (step === 0) {
      if (!category) return toast.error("Pick what this is about.");
      if (title.trim().length < 5) return toast.error("Give it a short title.");
      if (description.trim().length < 15) return toast.error("Tell us a little more.");
    }
    setBusy(true);
    const savedId = await persist();
    setBusy(false);
    if (savedId) setStep((current) => Math.min(current + 1, STEPS.length - 1));
  }

  async function submit() {
    if (!id) return;
    setBusy(true);
    const savedId = await persist();
    if (!savedId) return setBusy(false);
    const result = await submitComplaint({ id: savedId });
    setBusy(false);
    if (!result.ok) return toast.error(result.error);
    toast.success(`Received — ${result.data.code}`);
    router.push(`/dashboard/complaints/${result.data.id}?new=1`);
  }

  function useMyLocation() {
    if (!navigator.geolocation) return toast.error("This device cannot share a location.");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLatitude(Number(position.coords.latitude.toFixed(6)));
        setLongitude(Number(position.coords.longitude.toFixed(6)));
        toast.success("Location captured.");
      },
      () => toast.error("Could not get your location. Type the address instead."),
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <ol className="flex items-center gap-2 text-sm" aria-label="Progress">
        {STEPS.map((label, index) => (
          <li key={label} className="flex items-center gap-2">
            <span
              aria-current={index === step ? "step" : undefined}
              className={cn(
                "rounded-full px-3 py-1",
                index === step
                  ? "bg-primary text-primary-foreground"
                  : index < step
                    ? "bg-primary/10 text-primary"
                    : "bg-muted text-muted-foreground",
              )}
            >
              {index < step ? <Check className="mr-1 inline size-3" /> : null}
              {label}
            </span>
            {index < STEPS.length - 1 ? <span className="text-muted-foreground">—</span> : null}
          </li>
        ))}
        {saved ? (
          <li className="ml-auto text-xs text-muted-foreground" aria-live="polite">
            Draft saved
          </li>
        ) : null}
      </ol>

      {step === 0 ? (
        <div className="flex flex-col gap-5">
          <fieldset className="flex flex-col gap-3">
            <legend className="mb-2 font-medium">What is this about?</legend>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
              {CATEGORIES.map((value) => {
                const Icon = CATEGORY_ICON[value];
                const active = category === value;
                return (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setCategory(value)}
                    className={cn(
                      "flex flex-col items-center gap-2 rounded-2xl border p-3 text-xs font-medium transition-colors",
                      active ? "border-primary bg-primary/5 text-primary" : "hover:bg-muted",
                    )}
                  >
                    <Icon className="size-5" aria-hidden />
                    {CATEGORY_LABEL[value]}
                  </button>
                );
              })}
            </div>
          </fieldset>

          <div className="grid gap-2">
            <Label htmlFor="title">Give it a short title</Label>
            <Input
              id="title"
              value={title}
              maxLength={120}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Pothole near Ganesh temple"
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="description">What is happening?</Label>
            <Textarea
              id="description"
              value={description}
              maxLength={4000}
              rows={5}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Describe the problem, how long it has been there, and who it affects."
            />
          </div>

          {id ? (
            <div className="grid gap-2">
              <Label>Photos, video or a voice note</Label>
              <MediaUploader complaintId={id} initial={draft?.media ?? []} />
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Photos and voice notes can be added once you continue past this step.
            </p>
          )}
        </div>
      ) : null}

      {step === 1 ? (
        <div className="flex flex-col gap-5">
          <div>
            <h2 className="font-medium">Where is it?</h2>
            <p className="text-sm text-muted-foreground">
              {latitude && longitude
                ? `Pinned at ${latitude}, ${longitude}.`
                : homeWard
                  ? `Without a pin we'll file this under your ward, ${homeWard}.`
                  : "Share your location or describe where it is."}
            </p>
          </div>

          <div>
            <Button type="button" variant="outline" onClick={useMyLocation}>
              <Locate />
              Use my current location
            </Button>
          </div>

          {/* ponytail: no draggable map yet — GPS plus an address covers the citizen path.
              The Leaflet picker lands with the Transformation Map in Phase 4 and can reuse
              this same lat/lng state. */}

          <div className="grid gap-2">
            <Label htmlFor="address">Address or area</Label>
            <Input
              id="address"
              value={address}
              maxLength={200}
              onChange={(event) => setAddress(event.target.value)}
              placeholder="Market Road, near the bus stop"
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="landmark">Nearest landmark (optional)</Label>
            <Input
              id="landmark"
              value={landmark}
              maxLength={200}
              onChange={(event) => setLandmark(event.target.value)}
              placeholder="Opposite the temple"
            />
          </div>
        </div>
      ) : null}

      {step === 2 ? (
        <div className="flex flex-col gap-4">
          <h2 className="font-medium">Ready to send</h2>
          <dl className="grid gap-3 rounded-2xl border p-4 text-sm">
            <Row label="About" value={category ? CATEGORY_LABEL[category] : "—"} />
            <Row label="Title" value={title} />
            <Row label="Details" value={description} />
            <Row
              label="Where"
              value={
                [address, landmark].filter(Boolean).join(" · ") ||
                (latitude && longitude ? `${latitude}, ${longitude}` : homeWard ?? "—")
              }
            />
          </dl>
          <p className="text-sm text-muted-foreground">
            You'll get a tracking code the moment this is sent, and a notification at every
            step after that.
          </p>
        </div>
      ) : null}

      <div className="flex items-center gap-2">
        {step > 0 ? (
          <Button type="button" variant="ghost" onClick={() => setStep((c) => c - 1)} disabled={busy}>
            <ChevronLeft />
            Back
          </Button>
        ) : null}
        {step < STEPS.length - 1 ? (
          <Button type="button" onClick={next} disabled={busy} className="ml-auto">
            {busy ? <LoaderCircle className="animate-spin" /> : <ArrowRight />}
            Continue
          </Button>
        ) : (
          <Button type="button" onClick={submit} disabled={busy} className="ml-auto">
            {busy ? <LoaderCircle className="animate-spin" /> : <Send />}
            Send this concern
          </Button>
        )}
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-0.5 sm:grid-cols-[8rem_1fr]">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="whitespace-pre-wrap">{value || "—"}</dd>
    </div>
  );
}
