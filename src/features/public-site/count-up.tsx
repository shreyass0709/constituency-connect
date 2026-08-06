"use client";

import { useEffect, useRef, useState } from "react";

/**
 * The Action Dashboard's numbers count up once on arrival.
 *
 * It renders the final value on the server, so the figure is correct before any
 * JavaScript runs and there is no layout shift — the animation only replays the way it
 * got there. `prefers-reduced-motion` skips it entirely (docs/05-ui.md §1).
 */
export function CountUp({ value, durationMs = 1200 }: { value: number; durationMs?: number }) {
  const [display, setDisplay] = useState(value);
  const node = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let frame = 0;
    let start: number | null = null;
    const step = (now: number) => {
      start ??= now;
      const progress = Math.min((now - start) / durationMs, 1);
      // ease-out cubic: fast first, settles gently on the real number
      setDisplay(Math.round(value * (1 - (1 - progress) ** 3)));
      if (progress < 1) frame = requestAnimationFrame(step);
    };

    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [value, durationMs]);

  return (
    <span ref={node} className="tabular-nums">
      {display.toLocaleString("en-IN")}
    </span>
  );
}
