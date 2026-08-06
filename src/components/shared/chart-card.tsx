"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

/**
 * Recharts wrapped exactly once, so every chart in the app matches (docs/05-ui.md §3).
 * Colours come from the theme's CSS variables rather than hex literals, which is what
 * makes the charts work in dark mode without a second palette.
 */

type Series = { key: string; label: string; colour?: string };

const AXIS = {
  stroke: "currentColor",
  fontSize: 12,
  tickLine: false,
  axisLine: false,
} as const;

function Frame({
  title,
  subtitle,
  children,
  empty,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  empty: boolean;
}) {
  return (
    <section className="flex flex-col gap-3 rounded-2xl border p-5">
      <div>
        <h2 className="font-medium">{title}</h2>
        {subtitle ? <p className="text-xs text-muted-foreground">{subtitle}</p> : null}
      </div>
      {empty ? (
        <p className="py-12 text-center text-sm text-muted-foreground">Not enough data yet.</p>
      ) : (
        <div className="h-56 w-full text-muted-foreground">{children}</div>
      )}
    </section>
  );
}

const tooltipStyle = {
  contentStyle: {
    borderRadius: "0.75rem",
    border: "1px solid var(--border)",
    background: "var(--popover)",
    color: "var(--popover-foreground)",
    fontSize: 12,
  },
} as const;

export function TrendChart({
  title,
  subtitle,
  data,
  xKey,
  series,
}: {
  title: string;
  subtitle?: string;
  data: Record<string, string | number | null>[];
  xKey: string;
  series: Series[];
}) {
  return (
    <Frame title={title} subtitle={subtitle} empty={data.length < 2}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="currentColor" opacity={0.15} />
          <XAxis dataKey={xKey} {...AXIS} />
          <YAxis allowDecimals={false} {...AXIS} />
          <Tooltip {...tooltipStyle} />
          {series.map((item) => (
            <Area
              key={item.key}
              type="monotone"
              dataKey={item.key}
              name={item.label}
              stroke={item.colour ?? "var(--primary)"}
              fill={item.colour ?? "var(--primary)"}
              fillOpacity={0.15}
              strokeWidth={2}
            />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    </Frame>
  );
}

export function CategoryChart({
  title,
  data,
}: {
  title: string;
  data: { label: string; count: number }[];
}) {
  return (
    <Frame title={title} empty={data.length === 0}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="currentColor" opacity={0.15} />
          <XAxis dataKey="label" {...AXIS} interval={0} angle={-25} textAnchor="end" height={60} />
          <YAxis allowDecimals={false} {...AXIS} />
          <Tooltip {...tooltipStyle} />
          <Bar dataKey="count" name="Complaints" fill="var(--primary)" radius={[6, 6, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </Frame>
  );
}

export function SatisfactionChart({
  title,
  data,
}: {
  title: string;
  data: { month: string; rating: number | null }[];
}) {
  return (
    <Frame title={title} subtitle="Average rating out of 5" empty={data.length < 2}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="currentColor" opacity={0.15} />
          <XAxis dataKey="month" {...AXIS} />
          <YAxis domain={[0, 5]} {...AXIS} />
          <Tooltip {...tooltipStyle} />
          <Line
            type="monotone"
            dataKey="rating"
            name="Satisfaction"
            stroke="var(--primary)"
            strokeWidth={2}
            dot={{ r: 3 }}
            connectNulls
          />
        </LineChart>
      </ResponsiveContainer>
    </Frame>
  );
}
