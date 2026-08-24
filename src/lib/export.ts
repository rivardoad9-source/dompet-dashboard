import { getCategory } from "./categories";
import type { AppState, Transaction } from "./types";

function escapeCsv(value: string | number): string {
  const s = String(value);
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Give the browser a tick to start the download before revoking.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function stamp() {
  const d = new Date();
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * Semicolon-delimited so Excel with an Indonesian locale opens it in columns
 * without an import wizard. The BOM keeps accented characters intact.
 */
export function exportTransactionsCsv(transactions: Transaction[], filename?: string) {
  const header = ["Tanggal", "Tipe", "Kategori", "Nominal", "Catatan"];
  const rows = [...transactions]
    .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt)
    .map((t) => [
      t.date,
      t.type === "in" ? "Pemasukan" : "Pengeluaran",
      getCategory(t.categoryId).label,
      t.type === "in" ? t.amount : -t.amount,
      t.note,
    ]);

  const csv = [header, ...rows].map((r) => r.map(escapeCsv).join(";")).join("\r\n");
  download(
    new Blob([`﻿${csv}`], { type: "text/csv;charset=utf-8;" }),
    filename ?? `dompet-transaksi-${stamp()}.csv`,
  );
  return rows.length;
}

/** Full snapshot, so a user can move devices or keep an off-site backup. */
export function exportBackupJson(state: AppState) {
  const payload = {
    app: "dompet",
    version: 1,
    exportedAt: new Date().toISOString(),
    data: state,
  };
  download(
    new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" }),
    `dompet-backup-${stamp()}.json`,
  );
}

export interface ImportResult {
  ok: boolean;
  state?: AppState;
  error?: string;
}

export async function readBackupFile(file: File): Promise<ImportResult> {
  try {
    const text = await file.text();
    const parsed = JSON.parse(text) as { app?: string; data?: AppState } | AppState;
    const data = "data" in parsed && parsed.data ? parsed.data : (parsed as AppState);
    if (!data || !Array.isArray(data.transactions)) {
      return { ok: false, error: "Struktur file tidak dikenali." };
    }
    return { ok: true, state: data };
  } catch {
    return { ok: false, error: "File bukan JSON yang valid." };
  }
}
