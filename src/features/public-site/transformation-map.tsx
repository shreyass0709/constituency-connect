"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { LoaderCircle } from "lucide-react";
import type { ComplaintStatus } from "@/generated/prisma/enums";
import { CATEGORY_LABEL, STATUS_LABEL } from "@/constants/status";
import type { MapPin } from "./lib/pins";

/**
 * Leaflet against OpenStreetMap tiles — no per-load billing at public-site traffic, and
 * no API key to leak (docs/00 stack decisions).
 *
 * ponytail: raw Leaflet in an effect rather than a React wrapper library. The wrapper's
 * whole job is the twenty lines below, and it is one more package to keep in step with
 * React releases.
 *
 * ponytail: no heat layer yet — that needs leaflet.heat, and pins already answer "where
 * are the problems". Add it when someone is actually reading density off this map.
 */

const PIN_COLOUR: Record<string, string> = {
  ACKNOWLEDGED: "#0891b2",
  ASSIGNED: "#7c3aed",
  DEPT_REVIEW: "#7c3aed",
  FIELD_VERIFICATION: "#d97706",
  IN_PROGRESS: "#d97706",
  COMPLETED: "#65a30d",
  CLOSED: "#16a34a",
  PLANNED: "#64748b",
  ONGOING: "#d97706",
};

type MapData = {
  pins: MapPin[];
  wards: { id: string; number: number; name: string; boundary: unknown }[];
};

export function TransformationMap({ center }: { center: [number, number] }) {
  const container = useRef<HTMLDivElement>(null);
  const [data, setData] = useState<MapData | null>(null);
  const [error, setError] = useState(false);
  const [selected, setSelected] = useState<MapPin | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/v1/public/map")
      .then((response) => (response.ok ? response.json() : Promise.reject()))
      .then((body) => !cancelled && setData(body.data))
      .catch(() => !cancelled && setError(true));
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!data || !container.current) return;
    let map: import("leaflet").Map | undefined;
    let cancelled = false;

    // Leaflet touches `window` on import, so it loads here rather than at module scope.
    import("leaflet").then((L) => {
      if (cancelled || !container.current) return;

      map = L.map(container.current).setView(center, 13);
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "&copy; OpenStreetMap contributors",
        maxZoom: 19,
      }).addTo(map);

      for (const ward of data.wards) {
        if (!ward.boundary) continue;
        L.geoJSON(ward.boundary as never, {
          style: { color: "#3F51E0", weight: 1, fillOpacity: 0.04 },
        })
          .bindTooltip(ward.name)
          .addTo(map);
      }

      for (const pin of data.pins) {
        L.circleMarker([pin.latitude, pin.longitude], {
          radius: pin.kind === "project" ? 8 : 6,
          color: PIN_COLOUR[pin.status] ?? "#64748b",
          fillColor: PIN_COLOUR[pin.status] ?? "#64748b",
          fillOpacity: 0.75,
          weight: pin.kind === "project" ? 3 : 1,
        })
          .on("click", () => setSelected(pin))
          .addTo(map!);
      }
    });

    return () => {
      cancelled = true;
      map?.remove();
    };
  }, [data, center]);

  if (error) {
    return (
      <p className="rounded-2xl border border-dashed p-8 text-center text-muted-foreground">
        The map could not be loaded. The{" "}
        <Link href="/stories" className="text-primary hover:underline">
          impact stories
        </Link>{" "}
        cover the same ground.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="relative">
        <div
          ref={container}
          role="application"
          aria-label="Map of concerns and projects"
          className="h-[28rem] w-full rounded-2xl border bg-muted"
        />
        {!data ? (
          <span className="absolute inset-0 flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <LoaderCircle className="size-4 animate-spin" aria-hidden />
            Loading the map…
          </span>
        ) : null}
      </div>

      <Legend />

      {selected ? (
        <aside className="flex flex-col gap-2 rounded-2xl border p-4">
          <p className="font-medium">
            {selected.kind === "project"
              ? selected.title
              : CATEGORY_LABEL[selected.title as keyof typeof CATEGORY_LABEL] ?? selected.title}
          </p>
          <p className="text-sm text-muted-foreground">
            {selected.kind === "project"
              ? `Project · ${selected.status.toLowerCase()}`
              : STATUS_LABEL[selected.status as ComplaintStatus]}
          </p>
          {selected.storySlug ? (
            <Link href={`/stories/${selected.storySlug}`} className="text-sm text-primary hover:underline">
              Read what changed
            </Link>
          ) : null}
          {selected.kind === "complaint" ? (
            <p className="text-xs text-muted-foreground">
              Pins are moved up to 50 m so no home can be identified.
            </p>
          ) : null}
        </aside>
      ) : (
        <p className="text-sm text-muted-foreground">Tap a pin to see what it is.</p>
      )}
    </div>
  );
}

function Legend() {
  const entries: [string, string][] = [
    ["Acknowledged", PIN_COLOUR.ACKNOWLEDGED!],
    ["Assigned", PIN_COLOUR.ASSIGNED!],
    ["In progress", PIN_COLOUR.IN_PROGRESS!],
    ["Completed", PIN_COLOUR.COMPLETED!],
    ["Closed", PIN_COLOUR.CLOSED!],
  ];
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-2 text-xs text-muted-foreground">
      {entries.map(([label, colour]) => (
        <li key={label} className="flex items-center gap-1.5">
          <span
            aria-hidden
            className="size-2.5 rounded-full"
            style={{ backgroundColor: colour }}
          />
          {label}
        </li>
      ))}
    </ul>
  );
}
