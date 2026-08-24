"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { formatCompact, formatIDR, MASK } from "@/lib/format";
import { useReducedMotion } from "@/lib/hooks";

/**
 * Eases a number toward its target. Every setState happens inside the
 * requestAnimationFrame callback, never synchronously in the effect body.
 * With reduced motion the duration collapses to zero — one frame, no motion.
 */
export function useCountUp(target: number, enabled = true) {
  const reduced = useReducedMotion();
  const animate = enabled && !reduced;

  const [value, setValue] = useState(() => (enabled ? 0 : target));
  /** Last value painted, so an interrupted run resumes instead of jumping. */
  const currentRef = useRef(enabled ? 0 : target);

  useEffect(() => {
    const from = currentRef.current;
    const delta = target - from;
    if (delta === 0) return;

    const duration = animate ? 700 : 0;
    const start = performance.now();
    let raf = 0;

    const tick = (now: number) => {
      const elapsed = now - start;
      const t = duration > 0 ? Math.min(1, elapsed / duration) : 1;
      // easeOutExpo — fast settle, no overshoot on money figures.
      const eased = t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
      const next = from + delta * eased;
      currentRef.current = next;
      setValue(next);
      if (t < 1) raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, animate]);

  return value;
}

export function Money({
  value,
  privacy = false,
  compact = false,
  animate = true,
  signed = false,
  className,
}: {
  value: number;
  privacy?: boolean;
  compact?: boolean;
  animate?: boolean;
  signed?: boolean;
  className?: string;
}) {
  const shown = useCountUp(value, animate && !privacy);
  const display = privacy ? value : shown;

  if (privacy) {
    return <span className={cn("tabular-nums", className)}>{compact ? "••••" : MASK}</span>;
  }

  const text = compact ? formatCompact(display) : formatIDR(display);
  const prefix = signed && display > 0 ? "+" : "";

  return (
    <span className={cn("tabular-nums", className)} title={formatIDR(value)}>
      {prefix}
      {text}
    </span>
  );
}

export function Percent({
  value,
  animate = true,
  decimals = 0,
  className,
}: {
  value: number;
  animate?: boolean;
  decimals?: number;
  className?: string;
}) {
  const shown = useCountUp(value, animate);
  return (
    <span className={cn("tabular-nums", className)}>
      {shown.toFixed(decimals).replace(".", ",")}%
    </span>
  );
}
