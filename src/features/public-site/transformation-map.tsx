"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { LoaderCircle } from "lucide-react";
import { useTranslations } from "next-intl";
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
  const t = useTranslations("mapPage");
  const categoryLabel = useTranslations("category");
  const statusLabel = useTranslations("status");
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
        const title =
          pin.kind === "complaint" && categoryLabel.has(pin.title)
            ? categoryLabel(pin.title)
            : pin.title;
        const status =
          pin.kind === "project"
            ? t("project", { status: pin.status.toLowerCase() })
            : statusLabel(pin.status);
        const marker = L.circleMarker([pin.latitude, pin.longitude], {
          radius: pin.kind === "project" ? 8 : 6,
          color: PIN_COLOUR[pin.status] ?? "#64748b",
          fillColor: PIN_COLOUR[pin.status] ?? "#64748b",
          fillOpacity: 0.75,
          weight: pin.kind === "project" ? 3 : 1,
        })
          .on("click", () => setSelected(pin))
          .addTo(map!);

        // An SVG path is a mouse target and nothing else until it is told otherwise.
        const element = marker.getElement();
        if (element) {
          element.setAttribute("tabindex", "0");
          element.setAttribute("role", "button");
          element.setAttribute("aria-label", `${title} — ${status}`);
          element.addEventListener("keydown", (event) => {
            const key = (event as KeyboardEvent).key;
            if (key !== "Enter" && key !== " ") return;
            event.preventDefault();
            setSelected(pin);
          });
        }
      }
    });

    return () => {
      cancelled = true;
      map?.remove();
    };
  }, [data, center, t, categoryLabel, statusLabel]);

  if (error) {
    return (
      <p className="rounded-2xl border border-dashed p-8 text-center text-muted-foreground">
        {t.rich("failed", {
          stories: (chunks) => (
            <Link href="/stories" className="text-primary hover:underline">
              {chunks}
            </Link>
          ),
        })}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="relative">
        <div
          ref={container}
          role="application"
          aria-label={t("mapLabel")}
          className="h-[28rem] w-full rounded-2xl border bg-muted"
        />
        {!data ? (
          <span className="absolute inset-0 flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <LoaderCircle className="size-4 animate-spin" aria-hidden />
            {t("loading")}
          </span>
        ) : null}
      </div>

      <Legend />

      {/* The region stays mounted so the change is announced, not just the first insert. */}
      <div aria-live="polite">
        {selected ? (
          <aside className="flex flex-col gap-2 rounded-2xl border p-4">
            <p className="font-medium">
              {selected.kind === "project"
                ? selected.title
                : categoryLabel.has(selected.title)
                  ? categoryLabel(selected.title)
                  : selected.title}
            </p>
            <p className="text-sm text-muted-foreground">
              {selected.kind === "project"
                ? t("project", { status: selected.status.toLowerCase() })
                : statusLabel(selected.status)}
            </p>
            {selected.storySlug ? (
              <Link href={`/stories/${selected.storySlug}`} className="text-sm text-primary hover:underline">
                {t("readWhatChanged")}
              </Link>
            ) : null}
            {selected.kind === "complaint" ? (
              <p className="text-xs text-muted-foreground">
                {t("jitterNote")}
              </p>
            ) : null}
          </aside>
        ) : (
          <p className="text-sm text-muted-foreground">{t("tapPin")}</p>
        )}
      </div>
    </div>
  );
}

function Legend() {
  const statusLabel = useTranslations("status");
  const statuses = ["ACKNOWLEDGED", "ASSIGNED", "IN_PROGRESS", "COMPLETED", "CLOSED"] as const;

  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-2 text-xs text-muted-foreground">
      {statuses.map((status) => (
        <li key={status} className="flex items-center gap-1.5">
          <span
            aria-hidden
            className="size-2.5 rounded-full"
            style={{ backgroundColor: PIN_COLOUR[status] }}
          />
          {statusLabel(status)}
        </li>
      ))}
    </ul>
  );
}
