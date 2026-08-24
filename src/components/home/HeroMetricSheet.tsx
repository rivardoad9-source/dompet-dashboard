"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/cn";
import { HERO_METRICS, heroLabel, type HeroContext } from "@/lib/hero-metrics";
import type { HeroMetric } from "@/lib/types";
import { Money } from "@/components/ui/Money";
import { Sheet } from "@/components/ui/Sheet";

/**
 * Pemilih angka besar di kartu utama.
 *
 * Tiap baris menampilkan nilai aktualnya saat ini, bukan cuma nama metriknya.
 * Memilih tampilan sebaiknya tidak perlu ditebak lalu dibatalkan — dengan
 * pratinjau, pengguna melihat angka yang akan muncul sebelum memutuskan.
 */
export function HeroMetricSheet({
  open,
  onClose,
  value,
  onChange,
  context,
  monthKey,
  privacy,
}: {
  open: boolean;
  onClose: () => void;
  value: HeroMetric;
  onChange: (metric: HeroMetric) => void;
  context: HeroContext;
  monthKey: string;
  privacy: boolean;
}) {
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Tampilkan di kartu utama"
      description="Angka besar di Beranda, beserta dua angka pendampingnya."
    >
      <div role="radiogroup" aria-label="Metrik kartu utama" className="space-y-2 pb-4">
        {HERO_METRICS.map((metric) => {
          const active = metric.id === value;
          const Icon = metric.icon;

          return (
            <label
              key={metric.id}
              className={cn(
                "flex cursor-pointer items-start gap-3 rounded-xl border p-3",
                "transition-colors duration-200",
                active
                  ? "border-brand bg-brand-soft"
                  : "border-line hover:border-line-strong hover:bg-surface-2",
              )}
            >
              <input
                type="radio"
                name="hero-metric"
                value={metric.id}
                checked={active}
                onChange={() => {
                  onChange(metric.id);
                  onClose();
                }}
                className="peer sr-only"
              />

              <span
                aria-hidden
                className={cn(
                  "mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg",
                  active ? "bg-brand text-on-brand" : "bg-surface-2 text-ink-faint",
                )}
              >
                {active ? <Check className="size-4" strokeWidth={3} /> : <Icon className="size-4" />}
              </span>

              <span className="min-w-0 flex-1">
                <span className="flex items-baseline justify-between gap-2">
                  <span
                    className={cn(
                      "truncate text-sm font-bold",
                      active ? "text-brand" : "text-ink",
                    )}
                  >
                    {heroLabel(metric, monthKey)}
                  </span>
                  <Money
                    value={metric.value(context)}
                    privacy={privacy}
                    compact
                    animate={false}
                    signed={metric.signed}
                    className={cn(
                      "shrink-0 text-sm font-extrabold",
                      active ? "text-brand" : "text-ink-muted",
                    )}
                  />
                </span>
                <span className="mt-1 block text-[11px] leading-relaxed text-ink-muted">
                  {metric.hint}
                </span>
                <span className="mt-1.5 block text-[10px] font-semibold uppercase tracking-wider text-ink-faint">
                  Pendamping: {metric.companions.map((c) => c.label).join(" · ")}
                </span>
              </span>
            </label>
          );
        })}
      </div>
    </Sheet>
  );
}
