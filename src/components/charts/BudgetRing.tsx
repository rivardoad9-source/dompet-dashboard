"use client";

import { useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/cn";
import { clampPct, formatCompact, formatIDR, STATUS_META } from "@/lib/format";
import type { BudgetRow, BudgetSummary } from "@/lib/stats";
import { Percent } from "@/components/ui/Money";

const GAP_DEG = 2.2;

interface Arc {
  row: BudgetRow;
  /** Fractions of the full circle, already gapped. */
  offset: number;
  length: number;
}

/**
 * The PRD's headline visual: one ring that answers "how much of my budget is
 * gone?" and "what ate it?" at the same time.
 *
 * - Track      = total plafon for the month
 * - Segments   = each category's realised spend, proportional and colour-coded
 * - Outer arc  = overall realisation, tinted green / amber / red by status
 * - Centre     = the hovered category, or the month total when nothing is hovered
 */
export function BudgetRing({
  summary,
  privacy = false,
  size = 260,
  thickness = 22,
  className,
}: {
  summary: BudgetSummary;
  privacy?: boolean;
  size?: number;
  thickness?: number;
  className?: string;
}) {
  const [active, setActive] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  // One frame at zero length, then the arcs sweep out via CSS transition.
  // Reduced motion is handled globally: globals.css collapses the duration.
  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const radius = (size - thickness) / 2;
  const circumference = 2 * Math.PI * radius;
  const gapFraction = GAP_DEG / 360;

  const { arcs, overallPct } = useMemo(() => {
    const spent = summary.rows.filter((r) => r.spent > 0);
    const denominator = Math.max(summary.limit, summary.spent);
    if (denominator <= 0) return { arcs: [] as Arc[], overallPct: 0 };

    let cursor = 0;
    const list: Arc[] = spent.map((row) => {
      const raw = row.spent / denominator;
      const offset = cursor;
      cursor += raw;
      return { row, offset, length: Math.max(raw - gapFraction, raw * 0.55) };
    });

    return { arcs: list, overallPct: summary.pct };
  }, [summary, gapFraction]);

  const status = STATUS_META[summary.status];
  const activeRow = active ? summary.rows.find((r) => r.categoryId === active) : undefined;
  const animate = mounted;

  const outerRadius = radius + thickness / 2 + 7;
  const outerCircumference = 2 * Math.PI * outerRadius;
  const outerLength = (clampPct(overallPct) / 100) * outerCircumference;
  const boxSize = size + 20;

  return (
    <div className={cn("relative mx-auto", className)} style={{ width: boxSize, height: boxSize }}>
      <svg
        width={boxSize}
        height={boxSize}
        viewBox={`0 0 ${boxSize} ${boxSize}`}
        role="img"
        aria-label={`Realisasi anggaran ${Math.round(overallPct)} persen, status ${status.label}`}
        className="-rotate-90"
      >
        {/* Outer status arc */}
        <circle
          cx={boxSize / 2}
          cy={boxSize / 2}
          r={outerRadius}
          fill="none"
          stroke="var(--surface-3)"
          strokeWidth={3}
        />
        <circle
          cx={boxSize / 2}
          cy={boxSize / 2}
          r={outerRadius}
          fill="none"
          stroke={`var(${status.colorVar})`}
          strokeWidth={3}
          strokeLinecap="round"
          strokeDasharray={`${animate ? outerLength : 0} ${outerCircumference}`}
          className="transition-[stroke-dasharray] duration-1000 ease-out"
        />

        {/* Budget track */}
        <circle
          cx={boxSize / 2}
          cy={boxSize / 2}
          r={radius}
          fill="none"
          stroke="var(--surface-3)"
          strokeWidth={thickness}
        />

        {/* Category segments */}
        {arcs.map(({ row, offset, length }) => {
          const isActive = active === row.categoryId;
          const dimmed = active !== null && !isActive;
          return (
            <circle
              key={row.categoryId}
              cx={boxSize / 2}
              cy={boxSize / 2}
              r={radius}
              fill="none"
              stroke={`var(${row.colorVar})`}
              strokeWidth={isActive ? thickness + 5 : thickness}
              strokeLinecap="round"
              strokeDasharray={`${animate ? length * circumference : 0} ${circumference}`}
              strokeDashoffset={-offset * circumference}
              opacity={dimmed ? 0.32 : 1}
              className="cursor-pointer transition-all duration-500 ease-out"
              onMouseEnter={() => setActive(row.categoryId)}
              onMouseLeave={() => setActive(null)}
              onFocus={() => setActive(row.categoryId)}
              onBlur={() => setActive(null)}
              tabIndex={0}
              role="button"
              aria-label={`${row.label}: ${formatIDR(row.spent)}, ${Math.round(row.pct)} persen dari plafon`}
            />
          );
        })}
      </svg>

      {/* Centre readout */}
      <div className="pointer-events-none absolute inset-0 grid place-items-center px-10 text-center">
        {activeRow ? (
          <div key={activeRow.categoryId} className="dp-pop">
            <div className="flex items-center justify-center gap-1.5">
              <span
                className="size-2 rounded-full"
                style={{ background: `var(${activeRow.colorVar})` }}
              />
              <p className="truncate text-[11px] font-bold uppercase tracking-wider text-ink-muted">
                {activeRow.label}
              </p>
            </div>
            <p className="mt-1 text-2xl font-extrabold tracking-tight text-ink">
              {privacy ? "••••" : formatCompact(activeRow.spent)}
            </p>
            <p className="mt-0.5 text-xs text-ink-muted">
              {Math.round(activeRow.pct)}% dari {privacy ? "••••" : formatCompact(activeRow.limit)}
            </p>
          </div>
        ) : (
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-ink-muted">Terpakai</p>
            <Percent
              value={overallPct}
              className="mt-0.5 block text-[42px] font-extrabold leading-none tracking-tighter text-ink"
            />
            <p className="mt-1.5 text-xs font-medium text-ink-muted">
              {privacy ? "••••" : formatCompact(summary.spent)} /{" "}
              {privacy ? "••••" : formatCompact(summary.limit)}
            </p>
            <span
              className="mt-2 inline-flex items-center gap-1.5 rounded-pill px-2.5 py-1 text-[11px] font-bold"
              style={{ color: `var(${status.colorVar})`, background: `var(${status.softVar})` }}
            >
              <span className="size-1.5 rounded-full" style={{ background: `var(${status.colorVar})` }} />
              {status.label}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

/** Interactive legend paired with the ring — hovering a row lights its arc. */
export function RingLegend({
  summary,
  privacy = false,
  limit = 5,
}: {
  summary: BudgetSummary;
  privacy?: boolean;
  limit?: number;
}) {
  const rows = summary.rows.filter((r) => r.spent > 0).slice(0, limit);
  if (!rows.length) return null;

  return (
    <ul className="mt-5 space-y-2.5">
      {rows.map((row) => (
        <li key={row.categoryId} className="flex items-center gap-2.5 text-xs">
          <span className="size-2.5 shrink-0 rounded-full" style={{ background: `var(${row.colorVar})` }} />
          <span className="min-w-0 flex-1 truncate font-medium text-ink-muted">{row.label}</span>
          <span className="shrink-0 font-bold tabular-nums text-ink">
            {privacy ? "••••" : formatCompact(row.spent)}
          </span>
          <span
            className="w-11 shrink-0 text-right font-bold tabular-nums"
            style={{ color: `var(${STATUS_META[row.status].colorVar})` }}
          >
            {Math.round(row.pct)}%
          </span>
        </li>
      ))}
    </ul>
  );
}
