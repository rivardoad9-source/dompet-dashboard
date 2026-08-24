import { getCategory } from "./categories";
import { markBackupTaken } from "./durability";
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
  markBackupTaken(state.transactions.length);
}

export type ShareOutcome = "shared" | "downloaded" | "cancelled";

/**
 * Batas waktu menunggu share sheet.
 *
 * `navigator.share()` seharusnya selesai (pengguna memilih aplikasi) atau
 * ditolak dengan AbortError (pengguna menutupnya). Tapi di sebagian webview
 * dan lingkungan otomatis, promise-nya tidak pernah selesai sama sekali —
 * dan tanpa batas ini tombolnya macet di "Menyiapkan…" selamanya tanpa satu
 * pun pesan.
 *
 * Kalau batas ini terlampaui, berkasnya diunduh biasa: pengguna tetap
 * mendapatkan filenya. Risikonya cuma satu berkas ganda di folder Downloads
 * kalau ternyata share-nya berhasil juga — jauh lebih baik daripada tidak
 * mendapat apa-apa.
 */
const SHARE_TIMEOUT_MS = 30_000;

const SHARE_TIMED_OUT = Symbol("share-timeout");

async function shareWithTimeout(data: ShareData): Promise<"shared" | "cancelled" | typeof SHARE_TIMED_OUT> {
  let timer: ReturnType<typeof setTimeout> | undefined;

  const timeout = new Promise<typeof SHARE_TIMED_OUT>((resolve) => {
    timer = setTimeout(() => resolve(SHARE_TIMED_OUT), SHARE_TIMEOUT_MS);
  });

  const attempt = navigator
    .share(data)
    .then(() => "shared" as const)
    .catch((error: unknown) => {
      // Pengguna menutup share sheet — bukan kegagalan.
      if (error instanceof DOMException && error.name === "AbortError") return "cancelled" as const;
      return SHARE_TIMED_OUT; // kegagalan lain diperlakukan sama: unduh saja
    });

  try {
    return await Promise.race([attempt, timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/**
 * Menyalurkan satu berkas ke pengguna dengan cara terbaik yang tersedia.
 *
 * Di ponsel, share sheet bawaan sistem jauh lebih berguna daripada unduhan:
 * berkas bisa langsung dikirim ke WhatsApp, email, atau Drive tanpa pengguna
 * perlu berburu di folder Downloads. Di desktop dan browser yang belum
 * mendukung berbagi berkas, otomatis turun ke unduhan biasa.
 */
export async function deliverBlob(
  blob: Blob,
  filename: string,
  shareText: string,
): Promise<ShareOutcome> {
  const file = new File([blob], filename, { type: blob.type });

  const canShareFile =
    typeof navigator !== "undefined" &&
    typeof navigator.canShare === "function" &&
    navigator.canShare({ files: [file] });

  if (canShareFile) {
    const result = await shareWithTimeout({ files: [file], title: filename, text: shareText });
    if (result === "shared") return "shared";
    if (result === "cancelled") return "cancelled";
  }

  download(blob, filename);
  return "downloaded";
}

/** Nama berkas berstempel tanggal, dipakai semua format ekspor. */
export function exportFilename(extension: string, scope = "transaksi"): string {
  return `dompet-${scope}-${stamp()}.${extension}`;
}

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

  const outcome = await deliverBlob(
    new Blob([json], { type: "application/json" }),
    filename,
    "Backup data keuangan Dompet. Simpan filenya, lalu pulihkan lewat Pengaturan di perangkat baru.",
  );

  // Dibatalkan berarti tidak ada berkas yang benar-benar keluar, jadi jangan
  // dihitung sebagai backup — pengingatnya harus tetap menyala.
  if (outcome !== "cancelled") markBackupTaken(state.transactions.length);
  return outcome;
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
