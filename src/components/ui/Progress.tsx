"use client";

import { cn } from "@/lib/cn";
import { clampPct } from "@/lib/format";

/*
 * These bars animate purely in CSS: `dp-bar-grow` scales the fill in on mount,
 * and `transition-[width]` handles later value changes. No state, no effect —
 * and `prefers-reduced-motion` neutralises both for free (see globals.css).
 */

export function ProgressBar({
  value,
  colorVar = "--brand",
  trackVar,
  height = 8,
  className,
  label,
  animate = true,
}: {
  value: number;
  colorVar?: string;
  trackVar?: string;
  height?: number;
  className?: string;
  label?: string;
  animate?: boolean;
}) {
  const pct = clampPct(value);

  return (
    <div
      className={cn("w-full overflow-hidden rounded-pill", className)}
      style={{ height, background: trackVar ? `var(${trackVar})` : "var(--surface-3)" }}
      role="progressbar"
      aria-valuenow={Math.round(pct)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
    >
      <div
        className={cn("h-full rounded-pill transition-[width] duration-700 ease-out", animate && "dp-bar-grow")}
        style={{ width: `${pct}%`, background: `var(${colorVar})` }}
      />
    </div>
  );
}

/**
 * A bar that keeps rendering past 100% by stacking the overspend in a hatched
 * second segment, so "120% of budget" reads at a glance instead of pinning at
 * full.
 */
export function OverflowBar({
  value,
  colorVar,
  height = 8,
  className,
}: {
  value: number;
  colorVar: string;
  height?: number;
  className?: string;
}) {
  const over = value > 100;
  const base = clampPct(over ? 100 : value);
  const overflowShare = over ? clampPct(((value - 100) / value) * 100) : 0;

  return (
    <div
      className={cn("dp-bar-grow relative flex w-full overflow-hidden rounded-pill bg-surface-3", className)}
      style={{ height }}
      role="progressbar"
      aria-valuenow={Math.round(value)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className="h-full transition-[width] duration-700 ease-out"
        style={{ width: `${base - overflowShare}%`, background: `var(${colorVar})` }}
      />
      {over ? (
        <div
          className="h-full transition-[width] duration-700 ease-out"
          style={{
            width: `${overflowShare}%`,
            background:
              "repeating-linear-gradient(45deg, var(--danger) 0 4px, color-mix(in oklab, var(--danger) 65%, black) 4px 8px)",
          }}
        />
      ) : null}
    </div>
  );
}
