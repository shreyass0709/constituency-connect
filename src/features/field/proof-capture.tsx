"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { Camera, CircleCheckBig, LoaderCircle, MapPin, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { attachMedia } from "@/features/complaints/actions";
import { uploadToCloudinary } from "@/features/complaints/upload";

type Proof = { id: string; url: string; distanceMeters: number | null; offSite: boolean };

/**
 * Field proof: camera capture with the phone's GPS attached, so the office can see the
 * photo was taken at the site. Being far away is a warning on the record, never a block —
 * the officer may be standing across a highway with bad signal (docs/01 FR-5).
 */
export function ProofCapture({
  complaintId,
  initial,
}: {
  complaintId: string;
  initial: { id: string; url: string }[];
}) {
  const [items, setItems] = useState<Proof[]>(
    initial.map((item) => ({ ...item, distanceMeters: null, offSite: false })),
  );
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  /** Best-effort: no fix, no coordinates, upload anyway. */
  function currentPosition(): Promise<{ latitude: number; longitude: number } | null> {
    return new Promise((resolve) => {
      if (!navigator.geolocation) return resolve(null);
      navigator.geolocation.getCurrentPosition(
        (position) =>
          resolve({
            latitude: Number(position.coords.latitude.toFixed(6)),
            longitude: Number(position.coords.longitude.toFixed(6)),
          }),
        () => resolve(null),
        { enableHighAccuracy: true, timeout: 8000 },
      );
    });
  }

  async function add(file: File) {
    setBusy(true);
    try {
      const [position, uploaded] = await Promise.all([
        currentPosition(),
        uploadToCloudinary(file, file.type.startsWith("video/") ? "VIDEO" : "IMAGE", file.name),
      ]);
      const result = await attachMedia({
        complaintId,
        kind: file.type.startsWith("video/") ? "VIDEO" : "IMAGE",
        stage: "RESOLUTION",
        ...uploaded,
        ...(position ?? {}),
      });
      if (!result.ok) throw new Error(result.error);

      setItems((current) => [
        ...current,
        {
          id: result.data.id,
          url: result.data.url,
          distanceMeters: result.data.distanceMeters,
          offSite: result.data.offSite,
        },
      ]);
      if (result.data.offSite) {
        toast.warning(
          `Saved, but this was taken ${result.data.distanceMeters} m from the reported spot.`,
        );
      } else {
        toast.success(position ? "Proof saved and location verified." : "Proof saved.");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Upload failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <input
        ref={input}
        type="file"
        accept="image/*,video/*"
        capture="environment"
        hidden
        onChange={async (event) => {
          const files = [...(event.target.files ?? [])];
          event.target.value = "";
          for (const file of files) await add(file);
        }}
      />
      <Button type="button" variant="outline" disabled={busy} onClick={() => input.current?.click()}>
        {busy ? <LoaderCircle className="animate-spin" /> : <Camera />}
        Add proof photo
      </Button>

      {items.length > 0 ? (
        <ul className="flex flex-wrap gap-3">
          {items.map((item) => (
            <li key={item.id} className="flex flex-col items-center gap-1">
              <Image
                src={item.url}
                alt=""
                width={112}
                height={112}
                className="size-28 rounded-xl border object-cover"
              />
              {item.distanceMeters === null ? (
                <span className="flex items-center gap-1 text-[0.7rem] text-muted-foreground">
                  <MapPin className="size-3" aria-hidden />
                  no fix
                </span>
              ) : item.offSite ? (
                <span className="flex items-center gap-1 text-[0.7rem] text-amber-600 dark:text-amber-400">
                  <TriangleAlert className="size-3" aria-hidden />
                  {item.distanceMeters} m away
                </span>
              ) : (
                <span className="flex items-center gap-1 text-[0.7rem] text-green-600 dark:text-green-400">
                  <CircleCheckBig className="size-3" aria-hidden />
                  on site
                </span>
              )}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
