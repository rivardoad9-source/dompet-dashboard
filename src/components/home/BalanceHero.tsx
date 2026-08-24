"use client";

import { ArrowDownLeft, ArrowUpRight, Plus, PiggyBank } from "lucide-react";
import Link from "next/link";
import { formatCompact, monthLabel } from "@/lib/format";
import type { MonthTotals } from "@/lib/stats";
import { Money } from "@/components/ui/Money";
import { useTransactionSheet } from "@/components/transaction/TransactionSheetProvider";

/**
 * The "Header Saldo" from PRD §3A — total liquid balance plus this month's
 * income and spending, on the one card that anchors the whole dashboard.
 */
export function BalanceHero({
  balance,
  saved,
  totals,
  monthKey: key,
  privacy,
}: {
  balance: number;
  saved: number;
  totals: MonthTotals;
  monthKey: string;
  privacy: boolean;
}) {
  const sheet = useTransactionSheet();

  return (
    <div className="dp-hero dp-rise relative overflow-hidden rounded-card p-5 text-hero-ink shadow-float sm:p-6">
      {/* Ambient blobs — depth without an image request */}
      <div aria-hidden className="absolute -right-16 -top-20 size-56 rounded-full bg-hero-ink/10 blur-2xl" />
      <div aria-hidden className="absolute -bottom-24 -left-10 size-48 rounded-full bg-hero-ink/[0.07] blur-2xl" />

      <div className="relative">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-hero-ink-muted">
              Saldo likuid
            </p>
            <Money
              value={balance}
              privacy={privacy}
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

        <div className="mt-6 grid grid-cols-2 gap-3">
          <Stat
            icon={<ArrowDownLeft className="size-3.5" />}
            label={`Masuk · ${monthLabel(key, true)}`}
            value={totals.income}
            privacy={privacy}
          />
          <Stat
            icon={<ArrowUpRight className="size-3.5" />}
            label={`Keluar · ${monthLabel(key, true)}`}
            value={totals.expense}
            privacy={privacy}
          />
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
    </div>
  );
}

function Stat({
  icon,
  label,
  value,
  privacy,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  privacy: boolean;
}) {
  return (
    <div className="rounded-xl bg-hero-ink/10 p-3 backdrop-blur">
      <div className="flex items-center gap-1.5 text-hero-ink-muted">
        {icon}
        <span className="truncate text-[10px] font-bold uppercase tracking-wider">{label}</span>
      </div>
      <Money
        value={value}
        privacy={privacy}
        compact
        className="mt-1 block text-lg font-extrabold tracking-tight"
      />
    </div>
  );
}
