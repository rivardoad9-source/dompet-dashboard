import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { STATUS_META } from "@/lib/format";
import type { BudgetStatus } from "@/lib/types";

export function Badge({
  children,
  colorVar,
  softVar,
  className,
}: {
  children: ReactNode;
  colorVar?: string;
  softVar?: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-pill px-2.5 py-1 text-[11px] font-semibold leading-none",
        !colorVar && "bg-surface-2 text-ink-muted",
        className,
      )}
      style={
        colorVar
          ? {
              color: `var(${colorVar})`,
              background: softVar ? `var(${softVar})` : `color-mix(in oklab, var(${colorVar}) 14%, transparent)`,
            }
          : undefined
      }
    >
      {children}
    </span>
  );
}

/**
 * Status is never carried by colour alone — the label ships with it, so the
 * meaning survives greyscale printing and colour-vision differences.
 */
export function StatusBadge({ status, className }: { status: BudgetStatus; className?: string }) {
  const meta = STATUS_META[status];
  return (
    <Badge colorVar={meta.colorVar} softVar={meta.softVar} className={className}>
      <span
        aria-hidden
        className="size-1.5 rounded-full"
        style={{ background: `var(${meta.colorVar})` }}
      />
      {meta.label}
    </Badge>
  );
}

/** Signed percentage chip used on the stat tiles. */
export function DeltaBadge({ value, invert = false }: { value: number | null; invert?: boolean }) {
  if (value === null || !Number.isFinite(value)) {
    return <Badge className="text-ink-faint">Baru</Badge>;
  }
  const rising = value >= 0;
  const good = invert ? !rising : rising;
  return (
    <Badge colorVar={good ? "--success" : "--danger"} softVar={good ? "--success-soft" : "--danger-soft"}>
      {rising ? "▲" : "▼"} {Math.abs(value).toFixed(1)}%
    </Badge>
  );
}
