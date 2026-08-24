"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";

type Variant = "primary" | "secondary" | "ghost" | "soft" | "danger" | "hero";
type Size = "sm" | "md" | "lg" | "icon";

const VARIANTS: Record<Variant, string> = {
  primary: "bg-brand text-on-brand hover:bg-brand-strong active:scale-[0.98]",
  secondary:
    "border border-line bg-surface text-ink hover:bg-surface-2 hover:border-line-strong active:scale-[0.98]",
  ghost: "text-ink-muted hover:bg-surface-2 hover:text-ink active:scale-[0.98]",
  soft: "bg-brand-soft text-brand hover:bg-brand-tint active:scale-[0.98]",
  danger: "bg-danger text-on-danger hover:opacity-90 active:scale-[0.98]",
  hero: "bg-hero-ink/15 text-hero-ink backdrop-blur hover:bg-hero-ink/25 active:scale-[0.98]",
};

const SIZES: Record<Size, string> = {
  // 44px min height on the primary sizes keeps every tap target thumb-friendly.
  sm: "h-9 gap-1.5 rounded-xl px-3 text-xs",
  md: "h-11 gap-2 rounded-xl px-4 text-sm",
  lg: "h-12 gap-2 rounded-2xl px-5 text-sm",
  icon: "h-10 w-10 shrink-0 items-center justify-center rounded-xl",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  children?: ReactNode;
}

export function Button({
  variant = "primary",
  size = "md",
  className,
  type = "button",
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        "inline-flex cursor-pointer select-none items-center justify-center font-semibold",
        "transition-all duration-200 ease-out",
        "disabled:pointer-events-none disabled:opacity-45",
        "[touch-action:manipulation]",
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

/** Icon-only button. `label` is required — it becomes the accessible name. */
export function IconButton({
  label,
  variant = "ghost",
  className,
  children,
  ...rest
}: Omit<ButtonProps, "size"> & { label: string }) {
  return (
    <Button
      size="icon"
      variant={variant}
      aria-label={label}
      title={label}
      className={cn("inline-flex", className)}
      {...rest}
    >
      {children}
    </Button>
  );
}
