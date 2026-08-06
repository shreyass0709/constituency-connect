"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { Camera, LoaderCircle, Mic, Play, Square, X } from "lucide-react";
import { toast } from "sonner";
import type { MediaKind } from "@/generated/prisma/enums";
import { Button } from "@/components/ui/button";
import { attachMedia, removeMedia } from "./actions";

export type AttachedMedia = { id: string; kind: MediaKind; url: string };

/** Signed direct upload: sign → PUT to Cloudinary → record the row. */
async function uploadToCloudinary(file: Blob, kind: MediaKind, filename: string) {
  const signed = await fetch("/api/v1/uploads/sign", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ kind }),
  });
  const signedBody = await signed.json();
  if (!signed.ok) throw new Error(signedBody?.error?.message ?? "Uploads are unavailable.");

  const { uploadUrl, fields, maxBytes } = signedBody.data as {
    uploadUrl: string;
    fields: Record<string, string | number>;
    maxBytes: number;
  };
  if (file.size > maxBytes) {
    throw new Error(`That file is too large — the limit is ${Math.round(maxBytes / 1024 / 1024)} MB.`);
  }

  const form = new FormData();
  for (const [key, value] of Object.entries(fields)) form.append(key, String(value));
  form.append("file", file, filename);

  const upload = await fetch(uploadUrl, { method: "POST", body: form });
  const result = await upload.json();
  if (!upload.ok) throw new Error(result?.error?.message ?? "Upload failed. Try again.");

  return {
    url: result.secure_url as string,
    publicId: result.public_id as string,
    mimeType: file.type || null,
    sizeBytes: file.size,
  };
}

export function MediaUploader({
  complaintId,
  initial,
  disabled,
}: {
  complaintId: string;
  initial: AttachedMedia[];
  disabled?: boolean;
}) {
  const [items, setItems] = useState<AttachedMedia[]>(initial);
  const [busy, setBusy] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  async function add(blob: Blob, kind: MediaKind, filename: string) {
    setBusy(true);
    try {
      const uploaded = await uploadToCloudinary(blob, kind, filename);
      const result = await attachMedia({ complaintId, kind, ...uploaded });
      if (!result.ok) throw new Error(result.error);
      setItems((current) => [...current, result.data]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Upload failed.");
    } finally {
      setBusy(false);
    }
  }

  async function drop(id: string) {
    const previous = items;
    setItems((current) => current.filter((item) => item.id !== id));
    const result = await removeMedia({ id });
    if (!result.ok) {
      setItems(previous);
      toast.error(result.error);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        <input
          ref={fileInput}
          type="file"
          accept="image/*,video/*"
          capture="environment"
          multiple
          hidden
          onChange={async (event) => {
            const files = [...(event.target.files ?? [])];
            event.target.value = "";
            for (const file of files) {
              await add(file, file.type.startsWith("video/") ? "VIDEO" : "IMAGE", file.name);
            }
          }}
        />
        <Button
          type="button"
          variant="outline"
          disabled={disabled || busy}
          onClick={() => fileInput.current?.click()}
        >
          {busy ? <LoaderCircle className="animate-spin" /> : <Camera />}
          Add photo or video
        </Button>
        <VoiceRecorder disabled={disabled || busy} onRecorded={(blob) => add(blob, "AUDIO", "voice-note.webm")} />
      </div>

      {items.length > 0 ? (
        <ul className="flex flex-wrap gap-3">
          {items.map((item) => (
            <li key={item.id} className="relative">
              {item.kind === "IMAGE" ? (
                <Image
                  src={item.url}
                  alt=""
                  width={96}
                  height={96}
                  className="size-24 rounded-xl border object-cover"
                />
              ) : (
                <a
                  href={item.url}
                  target="_blank"
                  rel="noreferrer"
                  className="flex size-24 flex-col items-center justify-center gap-1 rounded-xl border text-xs text-muted-foreground"
                >
                  <Play className="size-5" />
                  {item.kind === "AUDIO" ? "Voice note" : "Video"}
                </a>
              )}
              {disabled ? null : (
                <button
                  type="button"
                  onClick={() => drop(item.id)}
                  aria-label="Remove attachment"
                  className="absolute -right-2 -top-2 rounded-full border bg-background p-1 shadow-sm"
                >
                  <X className="size-3" />
                </button>
              )}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

/**
 * Voice notes matter here — plenty of citizens would rather speak than type.
 * MediaRecorder is native; Phase 3 sends the same blob to Gemini for transcription.
 */
function VoiceRecorder({
  onRecorded,
  disabled,
}: {
  onRecorded: (blob: Blob) => void;
  disabled?: boolean;
}) {
  const recorder = useRef<MediaRecorder | null>(null);
  const [recording, setRecording] = useState(false);

  async function start() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const chunks: BlobPart[] = [];
      const instance = new MediaRecorder(stream);
      instance.ondataavailable = (event) => chunks.push(event.data);
      instance.onstop = () => {
        stream.getTracks().forEach((track) => track.stop());
        setRecording(false);
        onRecorded(new Blob(chunks, { type: instance.mimeType || "audio/webm" }));
      };
      instance.start();
      recorder.current = instance;
      setRecording(true);
    } catch {
      toast.error("Could not use the microphone. Check the browser permission.");
    }
  }

  return (
    <Button
      type="button"
      variant={recording ? "destructive" : "outline"}
      disabled={disabled}
      onClick={() => (recording ? recorder.current?.stop() : start())}
    >
      {recording ? <Square /> : <Mic />}
      {recording ? "Stop recording" : "Record a voice note"}
    </Button>
  );
}
