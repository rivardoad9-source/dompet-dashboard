"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/cn";
import { monthKey, monthLabel, shiftMonth } from "@/lib/format";

/** Prev / label / next stepper. Never steps past the current month. */
export function MonthPicker({
  value,
  onChange,
  className,
  compact = false,
}: {
  value: string;
  onChange: (key: string) => void;
  className?: string;
  compact?: boolean;
}) {
  const current = monthKey(new Date());
  const atLatest = value >= current;

  return (
    <div
      className={cn(
        "inline-flex items-center gap-0.5 rounded-xl border border-line bg-surface p-0.5",
        className,
      )}
    >
      <button
        type="button"
        aria-label="Bulan sebelumnya"
        onClick={() => onChange(shiftMonth(value, -1))}
        className="grid size-8 cursor-pointer place-items-center rounded-lg text-ink-muted transition-colors duration-200 hover:bg-surface-2 hover:text-ink"
      >
        <ChevronLeft className="size-4" />
      </button>

      <span
        className={cn(
          "min-w-[104px] select-none px-1 text-center font-bold text-ink",
          compact ? "text-xs" : "text-[13px]",
        )}
        aria-live="polite"
      >
        {monthLabel(value)}
      </span>

      <button
        type="button"
        aria-label="Bulan berikutnya"
        disabled={atLatest}
        onClick={() => onChange(shiftMonth(value, 1))}
        className="grid size-8 cursor-pointer place-items-center rounded-lg text-ink-muted transition-colors duration-200 hover:bg-surface-2 hover:text-ink disabled:pointer-events-none disabled:opacity-35"
      >
        <ChevronRight className="size-4" />
      </button>
    </div>
  );
}
