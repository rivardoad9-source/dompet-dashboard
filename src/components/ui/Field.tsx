"use client";

import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";
import { useId } from "react";
import { cn } from "@/lib/cn";
import { formatNumberInput, parseNumberInput } from "@/lib/format";

const CONTROL =
  "w-full rounded-xl border border-line bg-surface-2 px-3.5 text-sm text-ink placeholder:text-ink-faint " +
  "transition-colors duration-200 hover:border-line-strong focus:border-brand focus:bg-surface focus:outline-none";

/** Label is always visible — placeholders alone fail once a field is filled. */
export function Field({
  label,
  hint,
  error,
  children,
  htmlFor,
  className,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: ReactNode;
  htmlFor?: string;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <label htmlFor={htmlFor} className="block text-xs font-semibold text-ink-muted">
        {label}
      </label>
      {children}
      {error ? (
        <p className="text-xs font-medium text-danger" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="text-xs text-ink-faint">{hint}</p>
      ) : null}
    </div>
  );
}

export function Input({ className, ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(CONTROL, "h-11", className)} {...rest} />;
}

/* `Textarea` and `Select` are unused by the stock screens — they are here so
   the form kit is complete when you add your own fields. Safe to delete. */

export function Textarea({ className, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(CONTROL, "min-h-20 resize-y py-2.5", className)} {...rest} />;
}

export function Select({ className, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={cn(CONTROL, "h-11 cursor-pointer appearance-none pr-9", className)} {...rest}>
      {children}
    </select>
  );
}

/**
 * Rupiah input. Keeps a grouped string on screen ("1.250.000") while handing
 * the parent a plain number, and opens the numeric keypad on mobile.
 */
export function AmountInput({
  value,
  onValueChange,
  autoFocus,
  id,
  className,
  placeholder = "0",
}: {
  value: number;
  onValueChange: (value: number) => void;
  autoFocus?: boolean;
  id?: string;
  className?: string;
  placeholder?: string;
}) {
  const generated = useId();
  const inputId = id ?? generated;

  return (
    <div className={cn("relative", className)}>
      <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-lg font-bold text-ink-faint">
        Rp
      </span>
      <input
        id={inputId}
        inputMode="numeric"
        autoComplete="off"
        /* Rp 999.999.999.999 dengan pemisah ribuan = 19 karakter. Batas
           sebenarnya dijaga clampAmount; ini sekadar menghentikan ketikan
           yang jelas tidak masuk akal sebelum sampai ke sana. */
        maxLength={19}
        autoFocus={autoFocus}
        value={value ? formatNumberInput(String(value)) : ""}
        placeholder={placeholder}
        onChange={(e) => onValueChange(parseNumberInput(e.target.value))}
        className={cn(
          CONTROL,
          "h-16 pl-12 pr-4 text-right text-2xl font-extrabold tabular-nums tracking-tight",
        )}
      />
    </div>
  );
}

/** One-tap amount presets — the fastest path for the common small expense. */
export function QuickAmounts({
  values,
  onPick,
}: {
  values: number[];
  onPick: (value: number) => void;
}) {
  return (
    <div className="dp-no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
      {values.map((v) => (
        <button
          key={v}
          type="button"
          onClick={() => onPick(v)}
          className="shrink-0 cursor-pointer rounded-pill border border-line bg-surface-2 px-3 py-1.5 text-xs font-semibold text-ink-muted transition-colors duration-200 hover:border-brand hover:text-brand"
        >
          +{v >= 1000 ? `${v / 1000}rb` : v}
        </button>
      ))}
    </div>
  );
}
