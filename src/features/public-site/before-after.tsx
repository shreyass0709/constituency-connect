"use client";

import { useState } from "react";

import { publicImageUrl } from "./lib/public-image";

/**
 * The before/after wipe. A range input on top of two stacked images: it is keyboard
 * operable for free, screen readers announce it as a slider, and it costs no dependency.
 */
export function BeforeAfter({
  before,
  after,
  label = "Before and after",
}: {
  before: string;
  after: string;
  label?: string;
}) {
  const [position, setPosition] = useState(50);

  return (
    <figure className="flex flex-col gap-2">
      <div className="relative aspect-video overflow-hidden rounded-2xl border">
        {/* eslint-disable @next/next/no-img-element -- both layers must share one
            absolutely-positioned box for the clip to line up; next/image's own wrapper
            div breaks the overlay. Because these bypass next/image, nothing else re-encodes
            them, so `publicImageUrl` is what strips the EXIF off a citizen's photo here. */}
        <img
          src={publicImageUrl(before)}
          alt={`${label} — before`}
          className="absolute inset-0 size-full object-cover"
        />
        <img
          src={publicImageUrl(after)}
          alt={`${label} — after`}
          className="absolute inset-0 size-full object-cover"
          style={{ clipPath: `inset(0 0 0 ${position}%)` }}
        />
        {/* eslint-enable @next/next/no-img-element */}
        <span
          aria-hidden
          className="absolute inset-y-0 w-0.5 bg-white shadow"
          style={{ left: `${position}%` }}
        />
        <input
          type="range"
          min={0}
          max={100}
          value={position}
          onChange={(event) => setPosition(Number(event.target.value))}
          aria-label={`${label}: drag to compare`}
          className="absolute inset-0 size-full cursor-ew-resize opacity-0"
        />
        <span className="absolute bottom-2 left-2 rounded bg-black/60 px-2 py-0.5 text-xs text-white">
          Before
        </span>
        <span className="absolute bottom-2 right-2 rounded bg-black/60 px-2 py-0.5 text-xs text-white">
          After
        </span>
      </div>
      <figcaption className="text-xs text-muted-foreground">
        Drag the slider, or use the arrow keys, to compare.
      </figcaption>
    </figure>
  );
}
