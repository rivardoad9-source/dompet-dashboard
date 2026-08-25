"use client";

import { CalendarDays, ChevronRight, Flame, ShieldCheck, Wallet, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { formatCompact } from "@/lib/format";
import type { BudgetSummary } from "@/lib/stats";
import { DeltaBadge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";

/**
 * Tiap kartu metrik adalah pintu ke halaman yang bisa menindaklanjutinya.
 *
 * Angka tanpa tindak lanjut membuat orang mengetuknya lalu tidak terjadi
 * apa-apa — dan itu terbaca sebagai aplikasi yang rusak, bukan sebagai
 * keputusan desain. Panah kecil di pojok adalah tanda bahwa kartunya hidup.
 */
function Tile({
  icon: Icon,
  label,
  value,
  hint,
  colorVar,
  badge,
  href,
  goesTo,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  hint: string;
  colorVar: string;
  badge?: React.ReactNode;
  href: string;
  /** Dibacakan pembaca layar: ke mana kartu ini membawa. */
  goesTo: string;
}) {
  return (
    <Card className="dp-rise p-0">
      <Link
        href={href}
        aria-label={`${label} ${value}. ${goesTo}`}
        className="group block rounded-card p-4 transition-colors duration-200 hover:bg-surface-2 active:scale-[0.99]"
      >
        <div className="flex items-start justify-between gap-2">
          <span
            className="grid size-9 place-items-center rounded-xl transition-transform duration-200 group-hover:scale-105"
            style={{
              background: `color-mix(in oklab, var(${colorVar}) 15%, var(--surface))`,
              color: `var(${colorVar})`,
            }}
          >
            <Icon className="size-[18px]" />
          </span>
          {badge ?? (
            <ChevronRight
              aria-hidden
              className="size-4 text-ink-faint transition-transform duration-200 group-hover:translate-x-0.5"
            />
          )}
        </div>
        <p className="mt-3 flex items-center gap-1 truncate text-[11px] font-bold uppercase tracking-wider text-ink-muted">
          {label}
        </p>
        <p className="mt-0.5 truncate text-xl font-extrabold tracking-tight text-ink">{value}</p>
        <p className="mt-1 truncate text-[11px] text-ink-faint">{hint}</p>
      </Link>
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
        href="/riwayat?type=out"
        goesTo="Buka Riwayat, tersaring pengeluaran"
      />
      <Tile
        icon={Wallet}
        label="Plafon"
        value={mask(summary.limit)}
        hint={`${summary.rows.length} kategori aktif`}
        colorVar="--cat-4"
        href="/anggaran"
        goesTo="Buka Anggaran untuk mengubah plafon"
      />
      <Tile
        icon={ShieldCheck}
        label="Sisa aman"
        value={mask(safeRemaining)}
        hint={summary.remaining < 0 ? `Lewat ${mask(-summary.remaining)}` : "Masih dalam batas"}
        colorVar={summary.remaining < 0 ? "--danger" : "--success"}
        href="/anggaran"
        goesTo="Buka Anggaran untuk melihat rinciannya"
      />
      <Tile
        icon={CalendarDays}
        label="Jatah harian"
        value={mask(perDay)}
        hint={daysLeft > 0 ? `Sisa ${daysLeft} hari bulan ini` : "Bulan sudah selesai"}
        colorVar="--cat-6"
        href="/anggaran"
        goesTo="Buka Anggaran untuk menyesuaikan plafon"
      />
    </div>
  );
}
