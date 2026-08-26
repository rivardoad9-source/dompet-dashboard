"use client";

import { Receipt } from "lucide-react";
import { Fragment } from "react";
import { cn } from "@/lib/cn";
import { getCategory } from "@/lib/categories";
import { formatDateHuman, formatIDR } from "@/lib/format";
import type { Transaction } from "@/lib/types";
import { EmptyState } from "@/components/ui/Feedback";
import { useTransactionSheet } from "./TransactionSheetProvider";

export function TransactionRow({
  tx,
  privacy = false,
  showDate = false,
  onSelect,
}: {
  tx: Transaction;
  privacy?: boolean;
  showDate?: boolean;
  /**
   * Dipanggil tepat sebelum sheet edit dibuka.
   *
   * Baris ini membuka sheet edit global, jadi kalau ia dirender dari dalam
   * sheet lain (mis. rincian harian), hasilnya dua dialog bertumpuk — dan
   * karena masing-masing memasang listener Escape sendiri, satu tekan Escape
   * menutup dua-duanya. Pemanggil memakai kait ini untuk menutup dirinya
   * lebih dulu, sehingga hanya ada satu dialog terbuka kapan pun.
   */
  onSelect?: () => void;
}) {
  const sheet = useTransactionSheet();
  const cat = getCategory(tx.categoryId);
  const Icon = cat.icon;
  const income = tx.type === "in";

  return (
    <button
      type="button"
      onClick={() => {
        onSelect?.();
        sheet.open(tx);
      }}
      className={cn(
        "group flex w-full cursor-pointer items-center gap-3 rounded-xl px-2 py-2.5 text-left",
        "transition-colors duration-200 ease-out hover:bg-surface-2 active:scale-[0.99]",
      )}
      aria-label={`Edit ${cat.label} ${formatIDR(tx.amount)}`}
    >
      <span
        className="grid size-10 shrink-0 place-items-center rounded-xl transition-transform duration-200 group-hover:scale-105"
        style={{
          background: `color-mix(in oklab, var(${cat.colorVar}) 15%, var(--surface))`,
          color: `var(${cat.colorVar})`,
        }}
      >
        <Icon className="size-[18px]" />
      </span>

      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold text-ink">
          {tx.note || cat.label}
        </span>
        <span className="block truncate text-xs text-ink-muted">
          {cat.label}
          {showDate ? ` · ${formatDateHuman(tx.date)}` : ""}
        </span>
      </span>

      <span
        className="shrink-0 text-sm font-extrabold tabular-nums"
        style={{ color: income ? "var(--success)" : "var(--ink)" }}
      >
        {income ? "+" : "−"}
        {privacy ? " ••••" : formatIDR(tx.amount).replace("Rp", " Rp")}
      </span>
    </button>
  );
}

/** Flat list, newest first. Used for the "Aktivitas Terkini" card. */
export function TransactionList({
  transactions,
  privacy = false,
  emptyTitle = "Belum ada transaksi",
  emptyDescription = "Catat pengeluaran pertamamu lewat tombol + di bawah.",
  showDate = true,
  onSelect,
}: {
  transactions: Transaction[];
  privacy?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  showDate?: boolean;
  /** Diteruskan ke tiap baris — lihat `TransactionRow`. */
  onSelect?: () => void;
}) {
  if (!transactions.length) {
    return <EmptyState icon={Receipt} title={emptyTitle} description={emptyDescription} />;
  }

  return (
    <ul className="-mx-2 space-y-0.5">
      {transactions.map((tx) => (
        <li key={tx.id}>
          <TransactionRow tx={tx} privacy={privacy} showDate={showDate} onSelect={onSelect} />
        </li>
      ))}
    </ul>
  );
}

/** Same rows, bucketed under sticky day headers with a per-day net total. */
export function GroupedTransactionList({
  transactions,
  privacy = false,
}: {
  transactions: Transaction[];
  privacy?: boolean;
}) {
  if (!transactions.length) {
    return (
      <EmptyState
        icon={Receipt}
        title="Tidak ada transaksi"
        description="Coba longgarkan filter bulan, tipe, atau kategori."
      />
    );
  }

  const groups = new Map<string, Transaction[]>();
  for (const tx of transactions) {
    const list = groups.get(tx.date) ?? [];
    list.push(tx);
    groups.set(tx.date, list);
  }

  return (
    <div className="-mx-2">
      {[...groups.entries()].map(([date, rows]) => {
        const net = rows.reduce((s, t) => s + (t.type === "in" ? t.amount : -t.amount), 0);
        return (
          <Fragment key={date}>
            <div className="sticky top-16 z-10 flex items-center justify-between gap-3 bg-surface/95 px-2 py-2 backdrop-blur lg:top-[72px]">
              <span className="text-[11px] font-bold uppercase tracking-wider text-ink-muted">
                {formatDateHuman(date)}
              </span>
              <span
                className="text-[11px] font-bold tabular-nums"
                style={{ color: net >= 0 ? "var(--success)" : "var(--ink-faint)" }}
              >
                {privacy ? "••••" : `${net >= 0 ? "+" : "−"}${formatIDR(Math.abs(net))}`}
              </span>
            </div>
            <ul className="space-y-0.5 pb-2">
              {rows.map((tx) => (
                <li key={tx.id}>
                  <TransactionRow tx={tx} privacy={privacy} />
                </li>
              ))}
            </ul>
          </Fragment>
        );
      })}
    </div>
  );
}
