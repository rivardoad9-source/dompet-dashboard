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

function backupPayload(state: AppState): { json: string; filename: string } {
  const payload = {
    app: "dompet",
    version: 1,
    exportedAt: new Date().toISOString(),
    data: state,
  };
  return {
    json: JSON.stringify(payload, null, 2),
    filename: `dompet-backup-${stamp()}.json`,
  };
}

/** Full snapshot, so a user can move devices or keep an off-site backup. */
export function exportBackupJson(state: AppState) {
  const { json, filename } = backupPayload(state);
  download(new Blob([json], { type: "application/json" }), filename);
}

export type ShareOutcome = "shared" | "downloaded" | "cancelled";

/**
 * Di ponsel, mengunduh file JSON hampir tidak berguna: filenya mendarat di
 * folder Downloads dan pengguna harus berburu sendiri untuk mengirimkannya ke
 * perangkat baru. Share sheet bawaan sistem menyelesaikan itu — backup bisa
 * langsung dikirim ke WhatsApp, email, atau Drive dalam satu ketukan.
 *
 * Turun otomatis ke unduhan biasa di desktop dan di browser yang belum
 * mendukung berbagi berkas.
 */
export async function shareBackupJson(state: AppState): Promise<ShareOutcome> {
  const { json, filename } = backupPayload(state);
  const file = new File([json], filename, { type: "application/json" });

  const canShareFile =
    typeof navigator !== "undefined" &&
    typeof navigator.canShare === "function" &&
    navigator.canShare({ files: [file] });

  if (canShareFile) {
    try {
      await navigator.share({
        files: [file],
        title: "Backup Dompet",
        text: "Backup data keuangan Dompet. Simpan filenya, lalu pulihkan lewat Pengaturan di perangkat baru.",
      });
      return "shared";
    } catch (error) {
      // Pengguna menutup share sheet — itu bukan kegagalan, jangan diunduh diam-diam.
      if (error instanceof DOMException && error.name === "AbortError") return "cancelled";
      // Kegagalan lain (mis. target menolak file): jatuh ke unduhan biasa.
    }
  }

  download(new Blob([json], { type: "application/json" }), filename);
  return "downloaded";
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
