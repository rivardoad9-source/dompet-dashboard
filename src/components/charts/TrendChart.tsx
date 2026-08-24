"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatAxis, formatIDR } from "@/lib/format";
import type { TrendPoint } from "@/lib/stats";

const AXIS = {
  stroke: "var(--line)",
  tick: { fill: "var(--ink-faint)", fontSize: 11, fontWeight: 600 },
  tickLine: false,
  axisLine: false,
};

interface TooltipRow {
  name?: string;
  value?: number | string;
  color?: string;
  dataKey?: string | number;
}

function ChartTooltip({
  active,
  payload,
  label,
  privacy,
}: {
  active?: boolean;
  payload?: TooltipRow[];
  label?: string | number;
  privacy?: boolean;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-line bg-surface px-3 py-2.5 shadow-float">
      <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-ink-faint">{label}</p>
      <ul className="space-y-1">
        {payload.map((row) => (
          <li key={String(row.dataKey)} className="flex items-center gap-2 text-xs">
            <span className="size-2 rounded-full" style={{ background: row.color }} />
            <span className="text-ink-muted">{row.name}</span>
            <span className="ml-auto pl-3 font-bold tabular-nums text-ink">
              {privacy ? "••••" : formatIDR(Number(row.value ?? 0))}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Six-month cash flow: income area vs expense area. */
export function CashflowChart({
  data,
  privacy = false,
  height = 240,
}: {
  data: TrendPoint[];
  privacy?: boolean;
  height?: number;
}) {
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 6, left: -12, bottom: 0 }}>
          <defs>
            <linearGradient id="dp-grad-in" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--success)" stopOpacity={0.34} />
              <stop offset="100%" stopColor="var(--success)" stopOpacity={0.02} />
            </linearGradient>
            <linearGradient id="dp-grad-out" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--brand)" stopOpacity={0.36} />
              <stop offset="100%" stopColor="var(--brand)" stopOpacity={0.02} />
            </linearGradient>
          </defs>

          <CartesianGrid strokeDasharray="3 6" stroke="var(--line)" vertical={false} />
          <XAxis dataKey="label" {...AXIS} />
          <YAxis
            {...AXIS}
            width={48}
            tickFormatter={(v: number) => formatAxis(v, privacy)}
          />
          <Tooltip
            content={<ChartTooltip privacy={privacy} />}
            cursor={{ stroke: "var(--line-strong)", strokeWidth: 1, strokeDasharray: "4 4" }}
          />

          <Area
            type="monotone"
            dataKey="income"
            name="Pemasukan"
            stroke="var(--success)"
            strokeWidth={2.5}
            fill="url(#dp-grad-in)"
            dot={false}
            activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--surface)" }}
          />
          <Area
            type="monotone"
            dataKey="expense"
            name="Pengeluaran"
            stroke="var(--brand)"
            strokeWidth={2.5}
            fill="url(#dp-grad-out)"
            dot={false}
            activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--surface)" }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Net savings per month — green when you kept money, red when you didn't. */
export function NetBarChart({
  data,
  privacy = false,
  height = 170,
}: {
  data: TrendPoint[];
  privacy?: boolean;
  height?: number;
}) {
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 6, left: -12, bottom: 0 }} barCategoryGap="28%">
          <CartesianGrid strokeDasharray="3 6" stroke="var(--line)" vertical={false} />
          <XAxis dataKey="label" {...AXIS} />
          <YAxis
            {...AXIS}
            width={48}
            tickFormatter={(v: number) => formatAxis(v, privacy)}
          />
          <Tooltip
            content={<ChartTooltip privacy={privacy} />}
            cursor={{ fill: "var(--surface-2)" }}
          />
          <Bar dataKey="net" name="Sisa" radius={[6, 6, 6, 6]}>
            {data.map((d) => (
              <Cell key={d.key} fill={d.net >= 0 ? "var(--success)" : "var(--danger)"} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/**
 * Cumulative spend for the month against an even-pace reference line — the
 * quickest way to see whether you're burning too fast, not just too much.
 */
export function BurnChart({
  data,
  limit,
  privacy = false,
  height = 150,
}: {
  data: Array<{ day: number; cumulative: number }>;
  limit: number;
  privacy?: boolean;
  height?: number;
}) {
  const days = data.length || 1;
  const withPace = data.map((d) => ({ ...d, pace: (limit / days) * d.day }));

  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={withPace} margin={{ top: 8, right: 6, left: -12, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 6" stroke="var(--line)" vertical={false} />
          <XAxis dataKey="day" {...AXIS} interval={4} />
          <YAxis
            {...AXIS}
            width={48}
            tickFormatter={(v: number) => formatAxis(v, privacy)}
          />
          <Tooltip
            content={<ChartTooltip privacy={privacy} />}
            cursor={{ stroke: "var(--line-strong)", strokeWidth: 1, strokeDasharray: "4 4" }}
            labelFormatter={(d) => `Tanggal ${d}`}
          />
          <Line
            type="monotone"
            dataKey="pace"
            name="Laju ideal"
            stroke="var(--ink-faint)"
            strokeWidth={1.5}
            strokeDasharray="5 5"
            dot={false}
          />
          <Line
            type="monotone"
            dataKey="cumulative"
            name="Realisasi"
            stroke="var(--brand)"
            strokeWidth={2.5}
            dot={false}
            activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--surface)" }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
