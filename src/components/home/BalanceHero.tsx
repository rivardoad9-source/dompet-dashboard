"use client";

import { ChevronDown, LayoutGrid, Plus, PiggyBank, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { cn } from "@/lib/cn";
import { formatCompact, monthLabel } from "@/lib/format";
import { getCategory } from "@/lib/categories";
import { getHeroMetric, heroLabel, type HeroContext, type HeroStat } from "@/lib/hero-metrics";
import type { BudgetSummary, CategorySlice, MonthTotals } from "@/lib/stats";
import { actions } from "@/lib/store";
import type { HeroMetric } from "@/lib/types";
import { Money } from "@/components/ui/Money";
import { useTransactionSheet } from "@/components/transaction/TransactionSheetProvider";
import { HeroMetricSheet } from "./HeroMetricSheet";

/**
 * The "Header Saldo" from PRD §3A — the one card that anchors the dashboard.
 *
 * Angka besarnya bisa diganti pengguna lewat label yang berfungsi sebagai
 * tombol; dua angka pendampingnya ikut menyesuaikan supaya tidak ada nominal
 * yang tampil dua kali dalam satu kartu. Tabelnya di `lib/hero-metrics.ts`.
 */
export function BalanceHero({
  balance,
  saved,
  totals,
  summary,
  breakdown,
  metric,
  monthKey: key,
  privacy,
}: {
  balance: number;
  saved: number;
  totals: MonthTotals;
  summary: BudgetSummary;
  breakdown: CategorySlice[];
  metric: HeroMetric;
  monthKey: string;
  privacy: boolean;
}) {
  const sheet = useTransactionSheet();
  const [picking, setPicking] = useState(false);

  /*
   * Filter kategori hidup di state komponen, bukan di pengaturan tersimpan.
   *
   * Metrik besar (`heroMetric`) adalah pilihan menetap — dipilih sekali, dipakai
   * setiap hari. Menelusuri satu kategori adalah gerakan sekali pakai: dilihat,
   * lalu ditinggalkan. Menyimpannya berarti pengguna membuka aplikasi besok dan
   * menemukan angka utamanya masih tersaring tanpa ingat kenapa.
   */
  const [category, setCategory] = useState<string | null>(null);
  const slice = category ? (breakdown.find((b) => b.categoryId === category) ?? null) : null;

  const context: HeroContext = {
    balance,
    income: totals.income,
    expense: totals.expense,
    net: totals.net,
    budgetRemaining: summary.remaining,
    budgetLimit: summary.limit,
  };

  const active = getHeroMetric(metric);

  return (
    /*
     * Di layar kecil kartu ini menembus padding halaman dan menempel di bawah
     * topbar: sudut atas siku, sudut bawah membulat. Itu yang membuatnya
     * terbaca sebagai satu bidang hitam yang menutup layar, bukan sebagai kartu
     * pertama dari sebuah daftar. Di layar lebar ia kembali jadi kartu biasa,
     * karena di sana ia duduk di dalam kolom grid bersama kartu lain.
     */
    <div className="dp-hero dp-rise relative -mx-4 -mt-4 overflow-hidden rounded-b-[28px] p-5 pt-6 text-hero-ink sm:p-6 lg:mx-0 lg:mt-0 lg:rounded-card lg:shadow-float">
      {/* Ambient blobs — depth without an image request */}
      <div aria-hidden className="absolute -right-16 -top-20 size-56 rounded-full bg-hero-ink/10 blur-2xl" />
      <div aria-hidden className="absolute -bottom-24 -left-10 size-48 rounded-full bg-hero-ink/[0.07] blur-2xl" />

      <div className="relative">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            {slice ? (
              /* Saat disaring, label ini melaporkan kategorinya — bukan lagi
                 pemilih metrik. Pemilihnya kembali begitu chip "Semua" ditekan. */
              <p className="flex max-w-full items-center gap-1.5 py-0.5 text-[11px] font-bold uppercase tracking-[0.14em] text-hero-ink-muted">
                <span className="truncate">
                  {slice.label} · {monthLabel(key, true)}
                </span>
              </p>
            ) : (
              <button
                type="button"
                onClick={() => setPicking(true)}
                aria-haspopup="dialog"
                aria-expanded={picking}
                className={cn(
                  "flex max-w-full cursor-pointer items-center gap-1.5 rounded-lg py-0.5 pr-1",
                  "text-[11px] font-bold uppercase tracking-[0.14em] text-hero-ink-muted",
                  "transition-colors duration-200 hover:text-hero-ink",
                  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-current",
                )}
              >
                <span className="truncate">{heroLabel(active, key)}</span>
                <ChevronDown className="size-3.5 shrink-0" strokeWidth={3} />
              </button>
            )}

            <Money
              value={slice ? slice.amount : active.value(context)}
              privacy={privacy}
              signed={slice ? false : active.signed}
              className="mt-1.5 block text-[34px] font-extrabold leading-none tracking-tighter sm:text-[40px]"
            />
          </div>

          <Link
            href="/tabungan"
            className="hidden shrink-0 items-center gap-2 rounded-xl bg-hero-ink/15 px-3 py-2 text-xs font-bold backdrop-blur transition-colors duration-200 hover:bg-hero-ink/25 sm:inline-flex"
          >
            <PiggyBank className="size-4" />
            {privacy ? "••••" : formatCompact(saved)} tersimpan
          </Link>
        </div>

        <CategoryRow breakdown={breakdown} value={category} onChange={setCategory} />

        <div className="mt-4 grid grid-cols-2 gap-3">
          {slice ? (
            <>
              <PlainStat label="Transaksi" value={`${slice.count}`} />
              <PlainStat label="Dari pengeluaran" value={`${Math.round(slice.share)}%`} />
            </>
          ) : (
            active.companions.map((stat) => (
              <Stat
                key={stat.label}
                stat={stat}
                context={context}
                monthKey={key}
                privacy={privacy}
              />
            ))
          )}
        </div>

        <button
          type="button"
          onClick={() => sheet.open()}
          className="mt-5 flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-hero-ink/15 py-3 text-sm font-bold backdrop-blur transition-all duration-200 hover:bg-hero-ink/25 active:scale-[0.99] lg:hidden"
        >
          <Plus className="size-4" strokeWidth={2.6} />
          Catat Transaksi
        </button>
      </div>

      <HeroMetricSheet
        open={picking}
        onClose={() => setPicking(false)}
        value={active.id}
        onChange={(heroMetric) => actions.setSettings({ heroMetric })}
        context={context}
        monthKey={key}
        privacy={privacy}
      />
    </div>
  );
}

/**
 * Deret kategori yang menyaring angka besar di atasnya.
 *
 * Isinya hanya kategori yang benar-benar punya pengeluaran bulan ini, urut dari
 * yang terbesar — deret tetap berisi delapan kategori memaksa pengguna
 * menggulir melewati chip yang semuanya nol. Kalau bulan itu belum ada
 * pengeluaran sama sekali, deretnya tidak digambar: tidak ada yang bisa
 * disaring, dan baris kosong hanya menambah tinggi kartu.
 */
function CategoryRow({
  breakdown,
  value,
  onChange,
}: {
  breakdown: CategorySlice[];
  value: string | null;
  onChange: (value: string | null) => void;
}) {
  if (!breakdown.length) return null;

  const chips: Array<{ id: string | null; label: string; icon: LucideIcon }> = [
    { id: null, label: "Semua", icon: LayoutGrid },
    ...breakdown.map((b) => ({
      id: b.categoryId,
      label: getCategory(b.categoryId).label,
      icon: getCategory(b.categoryId).icon,
    })),
  ];

  return (
    <div
      className="dp-no-scrollbar -mx-5 mt-5 flex gap-2 overflow-x-auto px-5 sm:-mx-6 sm:px-6"
      role="group"
      aria-label="Saring angka utama per kategori"
    >
      {chips.map((chip) => {
        const active = chip.id === value;
        const Icon = chip.icon;
        return (
          <button
            key={chip.id ?? "all"}
            type="button"
            onClick={() => onChange(chip.id)}
            aria-pressed={active}
            className={cn(
              "w-[76px] shrink-0 cursor-pointer rounded-2xl px-1.5 py-2.5",
              "transition-colors duration-200 ease-out",
              active ? "bg-brand text-on-brand" : "bg-hero-ink/10 hover:bg-hero-ink/20",
            )}
          >
            <Icon className="mx-auto size-5" strokeWidth={2.2} />
            {/* Dua baris, bukan dipotong: label kategori di sini panjang-panjang
                ("Tagihan & Utilitas"), dan dipotong di satu baris membuat
                beberapa chip terbaca sama persis. Tingginya dikunci supaya
                chip satu baris dan dua baris tetap sejajar. */}
            <span className="mt-1.5 flex h-[26px] items-center justify-center text-center text-[10px] font-bold leading-[1.15] [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:2] overflow-hidden">
              {chip.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/** Kembaran `Stat` untuk angka yang bukan nominal — jumlah transaksi, persentase. */
function PlainStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-hero-ink/10 p-3 backdrop-blur">
      <span className="block truncate text-[10px] font-bold uppercase tracking-wider text-hero-ink-muted">
        {label}
      </span>
      <span className="mt-1 block text-lg font-extrabold tracking-tight">{value}</span>
    </div>
  );
}

function Stat({
  stat,
  context,
  monthKey: key,
  privacy,
}: {
  stat: HeroStat;
  context: HeroContext;
  monthKey: string;
  privacy: boolean;
}) {
  const Icon = stat.icon;

  return (
    <div className="rounded-xl bg-hero-ink/10 p-3 backdrop-blur">
      <div className="flex items-center gap-1.5 text-hero-ink-muted">
        <Icon className="size-3.5 shrink-0" />
        <span className="truncate text-[10px] font-bold uppercase tracking-wider">
          {heroLabel(stat, key)}
        </span>
      </div>
      <Money
        value={stat.value(context)}
        privacy={privacy}
        compact
        signed={stat.signed}
        className="mt-1 block text-lg font-extrabold tracking-tight"
      />
    </div>
  );
}
