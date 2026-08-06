"use client";

import { useRef, useState } from "react";
import { LoaderCircle, PenLine, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { attachMedia } from "@/features/complaints/actions";
import { uploadToCloudinary } from "@/features/complaints/upload";

/**
 * Sign-off on the phone. A canvas and four pointer events — a signature library would be
 * more code than the feature.
 */
export function SignaturePad({
  complaintId,
  onSigned,
}: {
  complaintId: string;
  onSigned: (mediaId: string) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [signed, setSigned] = useState(false);

  function context() {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#111827";
    return ctx;
  }

  function pointFrom(event: React.PointerEvent<HTMLCanvasElement>) {
    const rect = canvasRef.current!.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * canvasRef.current!.width,
      y: ((event.clientY - rect.top) / rect.height) * canvasRef.current!.height,
    };
  }

  function clear() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.getContext("2d")!.clearRect(0, 0, canvas.width, canvas.height);
    setDirty(false);
    setSigned(false);
  }

  async function save() {
    const canvas = canvasRef.current;
    if (!canvas || !dirty) return toast.error("Nothing signed yet.");
    setBusy(true);
    try {
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
      if (!blob) throw new Error("Could not read the signature.");

      const uploaded = await uploadToCloudinary(blob, "IMAGE", "signature.png");
      const result = await attachMedia({
        complaintId,
        kind: "IMAGE",
        stage: "SIGNATURE",
        ...uploaded,
      });
      if (!result.ok) throw new Error(result.error);

      onSigned(result.data.id);
      setSigned(true);
      toast.success("Signature attached.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save the signature.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <canvas
        ref={canvasRef}
        width={600}
        height={200}
        aria-label="Signature area"
        className="h-40 w-full touch-none rounded-xl border bg-white"
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture(event.pointerId);
          const { x, y } = pointFrom(event);
          const ctx = context();
          ctx.beginPath();
          ctx.moveTo(x, y);
          drawing.current = true;
          setDirty(true);
        }}
        onPointerMove={(event) => {
          if (!drawing.current) return;
          const { x, y } = pointFrom(event);
          const ctx = context();
          ctx.lineTo(x, y);
          ctx.stroke();
        }}
        onPointerUp={() => {
          drawing.current = false;
        }}
        onPointerLeave={() => {
          drawing.current = false;
        }}
      />
      <div className="flex gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={clear} disabled={busy}>
          <RotateCcw />
          Clear
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={save} disabled={busy || signed}>
          {busy ? <LoaderCircle className="animate-spin" /> : <PenLine />}
          {signed ? "Signed" : "Attach signature"}
        </Button>
      </div>
    </div>
  );
}
