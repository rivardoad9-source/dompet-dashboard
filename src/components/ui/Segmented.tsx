"use client";

import { cn } from "@/lib/cn";

export interface SegmentOption<T extends string> {
  value: T;
  label: string;
  colorVar?: string;
}

/**
 * Radio group styled as a pill switch. Rendered as real radios so arrow keys
 * and screen readers behave the way people expect.
 */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  name,
  size = "md",
  className,
}: {
  options: SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  name: string;
  size?: "sm" | "md";
  className?: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={name}
      className={cn("inline-flex w-full gap-1 rounded-2xl bg-surface-2 p-1", className)}
    >
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <label
            key={opt.value}
            className={cn(
              "relative flex flex-1 cursor-pointer items-center justify-center rounded-xl font-semibold",
              "transition-all duration-200 ease-out",
              size === "sm" ? "h-8 text-xs" : "h-10 text-sm",
              active ? "shadow-sm" : "text-ink-muted hover:text-ink",
            )}
            style={
              active
                ? {
                    background: opt.colorVar ? `var(${opt.colorVar})` : "var(--surface)",
                    color: opt.colorVar ? "#fff" : "var(--ink)",
                  }
                : undefined
            }
          >
            <input
              type="radio"
              name={name}
              value={opt.value}
              checked={active}
              onChange={() => onChange(opt.value)}
              className="sr-only"
            />
            {opt.label}
          </label>
        );
      })}
    </div>
  );
}

/** Filter chips: swipeable on phones, wrapping onto multiple rows on desktop. */
export function ChipRow<T extends string>({
  options,
  value,
  onChange,
  className,
}: {
  options: SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "dp-no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1",
        "lg:flex-wrap lg:overflow-x-visible",
        className,
      )}
    >
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            aria-pressed={active}
            className={cn(
              "shrink-0 cursor-pointer rounded-pill border px-3.5 py-2 text-xs font-semibold",
              "transition-all duration-200 ease-out",
              active
                ? "border-brand bg-brand text-on-brand"
                : "border-line bg-surface text-ink-muted hover:border-line-strong hover:text-ink",
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
