import type { AppState } from "./types";

/**
 * Lapisan yang menjaga data pengguna tetap ada.
 *
 * Tanpa server, satu-satunya salinan catatan keuangan pengguna hidup di
 * penyimpanan browser. Kehilangan data di aplikasi keuangan bukan gangguan
 * kecil — sekali terjadi, pengguna tidak akan mempercayai aplikasinya lagi.
 * Karena itu ada tiga pengaman berlapis di sini:
 *
 * 1. Minta status penyimpanan permanen, supaya browser tidak membuang data
 *    ini saat memori perangkat menipis.
 * 2. Simpan snapshot sebelum setiap tindakan merusak, supaya salah tekan
 *    masih bisa diurungkan.
 * 3. Catat kapan backup terakhir diambil, supaya aplikasi bisa mengingatkan
 *    sebelum terlambat.
 */

export const UNDO_KEY = "dompet.undo.v1";
export const META_KEY = "dompet.meta.v1";

/* ==========================================================================
   Penyimpanan permanen
   ========================================================================== */

export type PersistenceState = "granted" | "denied" | "unsupported";

/**
 * Meminta browser menandai penyimpanan situs ini sebagai permanen.
 *
 * Secara bawaan penyimpanan situs berstatus "best effort": saat ruang
 * perangkat menipis, browser boleh membuangnya tanpa bertanya. Status permanen
 * mengecualikan data ini dari pembersihan otomatis — hanya pengguna yang bisa
 * menghapusnya.
 *
 * Chrome memberikannya otomatis kalau aplikasi sudah dipasang ke layar utama
 * atau sering dibuka, jadi memanggilnya berulang kali tidak memunculkan
 * dialog mengganggu — kalau ditolak, ia hanya mengembalikan false.
 */
export async function requestPersistence(): Promise<PersistenceState> {
  if (typeof navigator === "undefined" || !navigator.storage?.persist) return "unsupported";

  try {
    if (await navigator.storage.persisted()) return "granted";
    return (await navigator.storage.persist()) ? "granted" : "denied";
  } catch {
    return "unsupported";
  }
}

/** Status saat ini, tanpa meminta ulang. */
export async function checkPersistence(): Promise<PersistenceState> {
  if (typeof navigator === "undefined" || !navigator.storage?.persisted) return "unsupported";
  try {
    return (await navigator.storage.persisted()) ? "granted" : "denied";
  } catch {
    return "unsupported";
  }
}

export interface StorageUsage {
  usedBytes: number;
  quotaBytes: number;
}

export async function estimateStorage(): Promise<StorageUsage | null> {
  if (typeof navigator === "undefined" || !navigator.storage?.estimate) return null;
  try {
    const { usage, quota } = await navigator.storage.estimate();
    if (usage === undefined || quota === undefined) return null;
    return { usedBytes: usage, quotaBytes: quota };
  } catch {
    return null;
  }
}

/* ==========================================================================
   Urungkan tindakan merusak
   ========================================================================== */

export interface UndoSnapshot {
  state: AppState;
  /** Tindakan yang menyebabkannya, mis. "Hapus semua data". */
  label: string;
  at: number;
  /** Jumlah transaksi sebelum tindakan itu — dipakai di teks konfirmasi. */
  transactions: number;
}

/**
 * Menyimpan keadaan sebelum tindakan merusak.
 *
 * Hanya satu tingkat, dan sengaja begitu: yang perlu diselamatkan adalah
 * "aduh, salah tekan Hapus semua" atau "impor Ganti semua padahal maksudnya
 * Tambahkan". Riwayat berlapis akan menggandakan pemakaian penyimpanan tanpa
 * menambah perlindungan yang berarti.
 */
export function saveUndo(state: AppState, label: string) {
  if (typeof window === "undefined") return;
  const snapshot: UndoSnapshot = {
    state,
    label,
    at: Date.now(),
    transactions: state.transactions.length,
  };
  try {
    window.localStorage.setItem(UNDO_KEY, JSON.stringify(snapshot));
  } catch {
    // Kuota penuh — tindakan utamanya tetap boleh jalan.
  }
}

export function readUndo(): UndoSnapshot | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(UNDO_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as UndoSnapshot;
    if (!parsed?.state || !Array.isArray(parsed.state.transactions)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearUndo() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(UNDO_KEY);
  } catch {
    // Tidak apa-apa; snapshot berikutnya akan menimpanya.
  }
}

/* ==========================================================================
   Jejak backup
   ========================================================================== */

export interface StorageMeta {
  lastBackupAt: number | null;
  /** Jumlah transaksi saat backup terakhir diambil. */
  transactionsAtBackup: number;
}

const EMPTY_META: StorageMeta = { lastBackupAt: null, transactionsAtBackup: 0 };

export function readMeta(): StorageMeta {
  if (typeof window === "undefined") return EMPTY_META;
  try {
    const raw = window.localStorage.getItem(META_KEY);
    if (!raw) return EMPTY_META;
    return { ...EMPTY_META, ...(JSON.parse(raw) as Partial<StorageMeta>) };
  } catch {
    return EMPTY_META;
  }
}

/** Dipanggil dari satu-satunya dua jalur yang menghasilkan berkas backup. */
export function markBackupTaken(transactionCount: number) {
  if (typeof window === "undefined") return;
  const meta: StorageMeta = {
    lastBackupAt: Date.now(),
    transactionsAtBackup: transactionCount,
  };
  try {
    window.localStorage.setItem(META_KEY, JSON.stringify(meta));
  } catch {
    // Penanda ini hanya untuk pengingat; kegagalannya tidak merusak apa pun.
  }
}

/** Berapa transaksi yang tercatat sejak backup terakhir. */
export function unbackedCount(current: number): number {
  const meta = readMeta();
  if (meta.lastBackupAt === null) return current;
  return Math.max(0, current - meta.transactionsAtBackup);
}
