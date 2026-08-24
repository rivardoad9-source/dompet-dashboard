"use client";

import { FileImage, FileJson, FileSpreadsheet, FileText, Printer, type LucideIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/cn";
import {
  deliverBlob,
  exportBackupJson,
  exportFilename,
  exportTransactionsCsv,
} from "@/lib/export";
import { buildRecapImage } from "@/lib/formats/recap";
import { buildTransactionsXlsx } from "@/lib/formats/xlsx";
import { monthLabel } from "@/lib/format";
import { budgetSummary, categoryBreakdown, monthTotals } from "@/lib/stats";
import { useStore } from "@/lib/store";
import type { Transaction } from "@/lib/types";
import { Sheet } from "@/components/ui/Sheet";
import { useToast } from "@/components/ui/Toast";
import { PrintStatement } from "./PrintStatement";

type Format = "pdf" | "xlsx" | "csv" | "image" | "json";

interface Option {
  id: Format;
  label: string;
  detail: string;
  icon: LucideIcon;
  colorVar: string;
}

const OPTIONS: Option[] = [
  {
    id: "pdf",
    label: "PDF",
    detail: "Laporan rapi siap cetak atau dikirim",
    icon: Printer,
    colorVar: "--cat-5",
  },
  {
    id: "xlsx",
    label: "Excel",
    detail: "Nominal sebagai angka, siap dijumlahkan",
    icon: FileSpreadsheet,
    colorVar: "--cat-3",
  },
  {
    id: "image",
    label: "Gambar",
    detail: "Kartu rekap bulanan untuk dibagikan",
    icon: FileImage,
    colorVar: "--cat-4",
  },
  {
    id: "csv",
    label: "CSV",
    detail: "Format polos untuk aplikasi lain",
    icon: FileText,
    colorVar: "--cat-2",
  },
  {
    id: "json",
    label: "Backup JSON",
    detail: "Seluruh data, untuk pindah perangkat",
    icon: FileJson,
    colorVar: "--cat-1",
  },
];

/**
 * Satu pintu untuk semua ekspor.
 *
 * Sebelumnya CSV tersembunyi di tab Riwayat sementara backup JSON ada di
 * Pengaturan, dan tidak ada cara mencetak sama sekali. Sekarang semuanya lewat
 * lembar ini, dengan penjelasan singkat tiap format supaya pengguna tidak perlu
 * menebak mana yang dia butuhkan.
 *
 * `transactions` adalah baris yang sedang tampil di pemanggil — jadi filter yang
 * aktif di tab Riwayat ikut terbawa ke hasil ekspor.
 */
export function ExportSheet({
  open,
  onClose,
  transactions,
  monthKey,
  scopeLabel,
}: {
  open: boolean;
  onClose: () => void;
  transactions: Transaction[];
  monthKey: string;
  scopeLabel: string;
}) {
  const { state } = useStore();
  const toast = useToast();
  const [busy, setBusy] = useState<Format | null>(null);
  const [printing, setPrinting] = useState(false);

  const summary = budgetSummary(state.transactions, state.budgets, monthKey);
  const totals = monthTotals(state.transactions, monthKey);
  const breakdown = categoryBreakdown(state.transactions, monthKey);

  /* Cetak baru boleh dipanggil setelah laporan benar-benar ada di DOM. */
  useEffect(() => {
    if (!printing) return;

    const done = () => setPrinting(false);
    window.addEventListener("afterprint", done);

    // Dua frame: satu untuk memasang node, satu untuk memastikan sudah dilukis.
    const id = requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        window.print();
        // Safari iOS tidak selalu memicu afterprint.
        setTimeout(() => setPrinting(false), 1000);
      }),
    );

    return () => {
      cancelAnimationFrame(id);
      window.removeEventListener("afterprint", done);
    };
  }, [printing]);

  async function run(format: Format) {
    if (busy) return;
    setBusy(format);

    try {
      if (format === "pdf") {
        if (!transactions.length) {
          toast.error("Tidak ada transaksi untuk dicetak.");
          return;
        }
        onClose();
        setPrinting(true);
        return;
      }

      if (format === "xlsx") {
        if (!transactions.length) {
          toast.error("Tidak ada transaksi untuk diekspor.");
          return;
        }
        const blob = buildTransactionsXlsx(transactions);
        const outcome = await deliverBlob(
          blob,
          exportFilename("xlsx"),
          `Transaksi ${scopeLabel} dari Dompet`,
        );
        if (outcome !== "cancelled") {
          toast.success(`${transactions.length} transaksi diekspor ke Excel`);
        }
        return;
      }

      if (format === "image") {
        const blob = await buildRecapImage({
          monthKey,
          summary,
          totals,
          breakdown,
          name: state.settings.name,
        });
        const outcome = await deliverBlob(
          blob,
          exportFilename("png", "rekap"),
          `Rekap ${monthLabel(monthKey)} dari Dompet`,
        );
        if (outcome !== "cancelled") toast.success("Gambar rekap dibuat");
        return;
      }

      if (format === "csv") {
        if (!transactions.length) {
          toast.error("Tidak ada transaksi untuk diekspor.");
          return;
        }
        const count = exportTransactionsCsv(transactions);
        toast.success(`${count} transaksi diekspor ke CSV`);
        return;
      }

      exportBackupJson(state);
      toast.success("Backup JSON diunduh");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Ekspor gagal.");
    } finally {
      setBusy(null);
      if (format !== "pdf") onClose();
    }
  }

  return (
    <>
      <Sheet
        open={open}
        onClose={onClose}
        title="Ekspor Data"
        description={`${transactions.length} transaksi · ${scopeLabel}`}
      >
        <ul className="space-y-2 pb-4">
          {OPTIONS.map((opt) => {
            const Icon = opt.icon;
            const loading = busy === opt.id;
            return (
              <li key={opt.id}>
                <button
                  type="button"
                  disabled={busy !== null}
                  onClick={() => void run(opt.id)}
                  className={cn(
                    "flex w-full cursor-pointer items-center gap-3.5 rounded-xl border border-line p-3.5 text-left",
                    "transition-all duration-200 ease-out",
                    "hover:border-line-strong hover:bg-surface-2 active:scale-[0.99]",
                    "disabled:pointer-events-none disabled:opacity-50",
                  )}
                >
                  <span
                    className="grid size-11 shrink-0 place-items-center rounded-xl"
                    style={{
                      background: `color-mix(in oklab, var(${opt.colorVar}) 15%, var(--surface))`,
                      color: `var(${opt.colorVar})`,
                    }}
                  >
                    <Icon className={cn("size-5", loading && "animate-pulse")} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-bold text-ink">
                      {loading ? "Menyiapkan…" : opt.label}
                    </span>
                    <span className="block text-[11px] leading-relaxed text-ink-muted">
                      {opt.detail}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </Sheet>

      {/* Hanya dipasang saat mencetak: pada tab Riwayat dengan ratusan baris,
          merender laporan ini terus-menerus akan membebani setiap render. */}
      {printing && typeof document !== "undefined"
        ? createPortal(
            <PrintStatement
              monthKey={monthKey}
              transactions={transactions}
              summary={summary}
              totals={totals}
              ownerName={state.settings.name}
              scopeLabel={scopeLabel}
            />,
            document.body,
          )
        : null}
    </>
  );
}
