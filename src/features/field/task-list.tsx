"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Navigation } from "lucide-react";
import { useTranslations } from "next-intl";
import { PriorityBadge, StatusChip } from "@/components/shared/status-chip";
import { distanceMeters } from "@/features/complaints/lib/geo";
import type { ComplaintCard } from "@/features/complaints/queries";
import { cn } from "@/lib/utils";

type Position = { latitude: number; longitude: number };

/**
 * Today's list, nearest first once the phone gives us a fix. Without one it stays in the
 * server's order — a field officer with GPS off still gets a working list.
 */
export function TaskList({ tasks }: { tasks: ComplaintCard[] }) {
  const t = useTranslations("field");
  const category = useTranslations("category");
  const [position, setPosition] = useState<Position | null>(null);

  useEffect(() => {
    if (!navigator.geolocation) return;
    const watch = navigator.geolocation.watchPosition(
      (fix) => setPosition({ latitude: fix.coords.latitude, longitude: fix.coords.longitude }),
      () => undefined,
      { enableHighAccuracy: true, maximumAge: 60_000 },
    );
    return () => navigator.geolocation.clearWatch(watch);
  }, []);

  const withDistance = tasks.map((task) => ({
    task,
    metres:
      position && typeof task.latitude === "number" && typeof task.longitude === "number"
        ? distanceMeters(position, { latitude: task.latitude, longitude: task.longitude })
        : null,
  }));
  if (position) {
    withDistance.sort((a, b) => (a.metres ?? Infinity) - (b.metres ?? Infinity));
  }

  return (
    <ul className="flex flex-col gap-2">
      {withDistance.map(({ task, metres }) => (
        <li key={task.id} className="rounded-2xl border">
          <div className="flex flex-col gap-3 p-4">
            <Link href={`/field/${task.id}`} className="flex flex-col gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-xs text-muted-foreground">{task.code}</span>
                <StatusChip status={task.status} />
                <PriorityBadge priority={task.priority} />
                {metres !== null ? (
                  <span
                    className={cn(
                      "rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium tabular-nums",
                      metres <= 200 && "bg-green-500/10 text-green-700 dark:text-green-300",
                    )}
                  >
                    {metres < 1000 ? `${metres} m` : `${(metres / 1000).toFixed(1)} km`}
                  </span>
                ) : null}
              </div>
              <p className="font-medium">{task.title}</p>
              <p className="text-xs text-muted-foreground">
                {category(task.category)}
                {task.address ? ` · ${task.address}` : ""}
                {task.ward ? ` · ${task.ward.name}` : ""}
              </p>
            </Link>

            {task.latitude && task.longitude ? (
              <a
                href={`https://www.openstreetmap.org/directions?to=${task.latitude},${task.longitude}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex w-fit items-center gap-2 rounded-lg border px-3 py-1.5 text-sm font-medium"
              >
                <Navigation className="size-4" aria-hidden />
                {t("navigate")}
              </a>
            ) : null}
          </div>
        </li>
      ))}
    </ul>
  );
}
