"use client";

import { ArrowDownLeft, ArrowUpRight } from "lucide-react";
import { useMemo } from "react";
import { formatDateHuman } from "@/lib/format";
import type { Transaction } from "@/lib/types";
import { Money } from "@/components/ui/Money";
import { Sheet } from "@/components/ui/Sheet";
import { TransactionList } from "@/components/transaction/TransactionList";

/**
 * Rincian satu hari, dibuka dari kalender.
 *
 * Barisnya memakai `TransactionList` yang sama dengan halaman lain, jadi
 * mengetuk salah satunya langsung membuka form edit — dengan satu syarat:
 * sheet ini harus menutup dirinya lebih dulu lewat `onSelect`, kalau tidak
 * akan ada dua dialog bertumpuk yang sama-sama menangkap tombol Escape.
 */
export function DayDetailSheet({
  iso,
  transactions,
  privacy,
  onClose,
}: {
  /** Tanggal `YYYY-MM-DD` yang sedang dibuka, atau null saat tertutup. */
  iso: string | null;
  transactions: Transaction[];
  privacy: boolean;
  onClose: () => void;
}) {
  const day = useMemo(() => {
    if (!iso) return null;
    const rows = transactions
      .filter((t) => t.date === iso)
      .sort((a, b) => b.createdAt - a.createdAt);
    return {
      rows,
      income: rows.reduce((s, t) => (t.type === "in" ? s + t.amount : s), 0),
      expense: rows.reduce((s, t) => (t.type === "out" ? s + t.amount : s), 0),
    };
  }, [iso, transactions]);

  if (!iso || !day) return null;

  return (
    <Sheet
      open
      onClose={onClose}
      title={formatDateHuman(iso)}
      description={
        day.rows.length === 1 ? "1 transaksi" : `${day.rows.length} transaksi tercatat`
      }
    >
      <div className="space-y-4 pb-4">
        <div className="grid grid-cols-2 gap-3">
          <Total label="Masuk" icon={ArrowDownLeft} value={day.income} colorVar="--success" privacy={privacy} />
          <Total label="Keluar" icon={ArrowUpRight} value={day.expense} colorVar="--brand" privacy={privacy} />
        </div>

        <TransactionList
          transactions={day.rows}
          privacy={privacy}
          showDate={false}
          onSelect={onClose}
          emptyTitle="Tidak ada transaksi"
          emptyDescription="Tidak ada catatan pada tanggal ini."
        />
      </div>
    </Sheet>
  );
}

function Total({
  label,
  icon: Icon,
  value,
  colorVar,
  privacy,
}: {
  label: string;
  icon: typeof ArrowDownLeft;
  value: number;
  colorVar: string;
  privacy: boolean;
}) {
  return (
    <div className="rounded-xl bg-surface-2 p-3">
      <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-ink-muted">
        <Icon className="size-3.5" style={{ color: `var(${colorVar})` }} />
        {label}
      </span>
      <Money
        value={value}
        privacy={privacy}
        animate={false}
        className="mt-1 block text-lg font-extrabold tracking-tight text-ink"
      />
    </div>
  );
}
