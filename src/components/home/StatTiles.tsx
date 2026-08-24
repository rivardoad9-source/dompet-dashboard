"use client";

import { CalendarDays, Flame, ShieldCheck, Wallet, type LucideIcon } from "lucide-react";
import { formatCompact } from "@/lib/format";
import type { BudgetSummary } from "@/lib/stats";
import { DeltaBadge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";

function Tile({
  icon: Icon,
  label,
  value,
  hint,
  colorVar,
  badge,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  hint: string;
  colorVar: string;
  badge?: React.ReactNode;
}) {
  return (
    <Card className="dp-rise p-4">
      <div className="flex items-start justify-between gap-2">
        <span
          className="grid size-9 place-items-center rounded-xl"
          style={{
            background: `color-mix(in oklab, var(${colorVar}) 15%, var(--surface))`,
            color: `var(${colorVar})`,
          }}
        >
          <Icon className="size-[18px]" />
        </span>
        {badge}
      </div>
      <p className="mt-3 truncate text-[11px] font-bold uppercase tracking-wider text-ink-muted">
        {label}
      </p>
      <p className="mt-0.5 truncate text-xl font-extrabold tracking-tight text-ink">{value}</p>
      <p className="mt-1 truncate text-[11px] text-ink-faint">{hint}</p>
    </Card>
  );
}

/**
 * The "Ringkasan Metrik" strip from PRD §3A: realisation, plafon, safe
 * remainder — plus a daily allowance figure that turns the number into a plan.
 */
export function StatTiles({
  summary,
  expenseDelta,
  daysLeft,
  privacy,
}: {
  summary: BudgetSummary;
  expenseDelta: number | null;
  daysLeft: number;
  privacy: boolean;
}) {
  const safeRemaining = Math.max(0, summary.remaining);
  const txCount = summary.rows.reduce((s, r) => s + r.txCount, 0);
  const perDay = daysLeft > 0 ? safeRemaining / daysLeft : safeRemaining;
  const mask = (n: number) => (privacy ? "••••" : formatCompact(n));

  return (
    <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
      <Tile
        icon={Flame}
        label="Realisasi"
        value={mask(summary.spent)}
        hint={`${txCount} transaksi tercatat`}
        colorVar="--brand"
        badge={<DeltaBadge value={expenseDelta} invert />}
      />
      <Tile
        icon={Wallet}
        label="Plafon"
        value={mask(summary.limit)}
        hint={`${summary.rows.length} kategori aktif`}
        colorVar="--cat-4"
      />
      <Tile
        icon={ShieldCheck}
        label="Sisa aman"
        value={mask(safeRemaining)}
        hint={summary.remaining < 0 ? `Lewat ${mask(-summary.remaining)}` : "Masih dalam batas"}
        colorVar={summary.remaining < 0 ? "--danger" : "--success"}
      />
      <Tile
        icon={CalendarDays}
        label="Jatah harian"
        value={mask(perDay)}
        hint={daysLeft > 0 ? `Sisa ${daysLeft} hari bulan ini` : "Bulan sudah selesai"}
        colorVar="--cat-6"
      />
    </div>
  );
}
