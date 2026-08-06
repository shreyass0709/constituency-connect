import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function StatCard({
  label,
  value,
  icon: Icon,
  href,
  tone,
}: {
  label: string;
  value: number | string;
  icon?: LucideIcon;
  href?: string;
  tone?: "default" | "warning";
}) {
  const body = (
    <div
      className={cn(
        "flex flex-col gap-1 rounded-2xl border p-4 transition-colors",
        href && "hover:bg-muted/50",
        tone === "warning" && "border-red-500/30 bg-red-500/5",
      )}
    >
      <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
        {Icon ? <Icon className="size-3.5" aria-hidden /> : null}
        {label}
      </div>
      <div className="font-heading text-3xl font-semibold tabular-nums">{value}</div>
    </div>
  );

  return href ? <Link href={href}>{body}</Link> : body;
}
