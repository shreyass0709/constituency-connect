import {
  BadgeIndianRupee,
  CircleCheckBig,
  Droplets,
  GraduationCap,
  House,
  Leaf,
  Stethoscope,
  Tractor,
  Construction,
  Users,
  type LucideIcon,
} from "lucide-react";
import { CountUp } from "./count-up";

/** `ActionStat.icon` holds a name, not markup — this maps the ones the seed ships with. */
const ICONS: Record<string, LucideIcon> = {
  citizens_assisted: Users,
  roads_improved: Construction,
  water_projects: Droplets,
  pensions: BadgeIndianRupee,
  scholarships: GraduationCap,
  trees_planted: Leaf,
  women_benefited: House,
  farmers_helped: Tractor,
  health_camps: Stethoscope,
};

export function ActionStats({
  stats,
}: {
  stats: { id: string; key: string; label: string; value: number }[];
}) {
  if (stats.length === 0) return null;

  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {stats.map((stat) => {
        const Icon = ICONS[stat.key] ?? CircleCheckBig;
        return (
          <li key={stat.id} className="flex flex-col gap-2 rounded-2xl border p-5">
            <Icon className="size-5 text-primary" aria-hidden />
            <span className="font-heading text-3xl font-semibold">
              <CountUp value={stat.value} />
            </span>
            <span className="text-sm text-muted-foreground">{stat.label}</span>
          </li>
        );
      })}
    </ul>
  );
}
