"use client";

import { useEffect, useSyncExternalStore } from "react";
import { DEMO_DATA_ON_FIRST_RUN } from "./config";
import { clearUndo, readUndo, requestPersistence, saveUndo } from "./durability";
import { clampAmount } from "./format";
import { isUuid, newId } from "./ids";
import { buildSeedState, emptyState } from "./seed";
import type { AppState, Budget, Deposit, Goal, Settings, ThemeName, Transaction } from "./types";

/**
 * Satu-satunya sumber data aplikasi.
 *
 * Semuanya hidup di localStorage browser — tidak ada server, tidak ada akun,
 * tidak ada environment variable. Buka aplikasi, langsung mencatat.
 *
 * Bentuknya external store yang dibaca lewat `useSyncExternalStore`, jadi
 * setiap komponen (ring anggaran, kartu metrik, progress bar tabungan) otomatis
 * ikut ter-render ulang begitu satu transaksi masuk — tanpa state manager.
 *
 * Batas praktis localStorage sekitar 5 MB. Satu transaksi ± 150 byte, jadi
 * puluhan ribu catatan masih muat. Kalau suatu saat perlu lebih, tukar
 * `persist()` dan `hydrateStore()` ke IndexedDB — tidak ada komponen yang perlu
 * ikut berubah.
 */

export const STORAGE_KEY = "dompet.state.v1";

interface Snapshot {
  state: AppState;
  /** False saat SSR dan render klien pertama, supaya skeleton yang tampil. */
  hydrated: boolean;
  /**
   * True kalau penulisan terakhir ke localStorage gagal.
   *
   * Ini kegagalan yang paling berbahaya di aplikasi tanpa server: kuota penuh
   * atau mode privat membuat setiap simpan ditolak, sementara aplikasi tetap
   * terlihat normal karena datanya masih ada di memori. Pengguna terus
   * mencatat, lalu kehilangan semuanya begitu tab ditutup. Jadi kegagalannya
   * harus terlihat, bukan ditelan diam-diam.
   */
  saveFailed: boolean;
}

const SERVER_SNAPSHOT: Snapshot = { state: emptyState(), hydrated: false, saveFailed: false };

let snapshot: Snapshot = SERVER_SNAPSHOT;
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

const getSnapshot = () => snapshot;
const getServerSnapshot = () => SERVER_SNAPSHOT;

/* ==========================================================================
   Persistensi
   ========================================================================== */

function persist(state: AppState): boolean {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch {
    // Kuota penuh atau mode privat. Pemanggil yang memutuskan apa yang
    // ditampilkan — lihat `saveFailed` di Snapshot.
    return false;
  }
}

function commit(next: AppState, save = true) {
  const saveFailed = save ? !persist(next) : snapshot.saveFailed;
  snapshot = { state: next, hydrated: true, saveFailed };
  emit();
}

/** Setiap mutasi pengguna lewat sini, jadi tidak ada jalur yang lupa menyimpan. */
function update(fn: (state: AppState) => AppState) {
  commit(fn(snapshot.state));
}

/** Pembacaan non-reaktif, untuk event handler yang tidak perlu berlangganan. */
export function readState(): AppState {
  return snapshot.state;
}

/* ==========================================================================
   Hidrasi
   ========================================================================== */

/** Gabungkan data tersimpan dengan default supaya save lama tetap terbaca. */
function reconcile(raw: unknown): AppState {
  const base = emptyState();
  if (!raw || typeof raw !== "object") return base;

  const parsed = raw as Partial<AppState>;
  const state: AppState = {
    transactions: Array.isArray(parsed.transactions) ? parsed.transactions : base.transactions,
    budgets: Array.isArray(parsed.budgets) && parsed.budgets.length ? parsed.budgets : base.budgets,
    goals: Array.isArray(parsed.goals) ? parsed.goals : base.goals,
    settings: { ...base.settings, ...(parsed.settings ?? {}) },
  };

  return sanitizeAmounts(migrateIds(migrateTheme(state)));
}

/**
 * Nama tema yang sudah tidak ada lagi, dipetakan ke penggantinya.
 *
 * `warm` (krem–terakota) dan `noir` (hitam penuh) keduanya digantikan `mono`.
 * Nama tema tersimpan di localStorage perangkat, jadi tanpa pemetaan ini
 * pengguna lama membuka aplikasi dengan nilai yang tidak dikenal siapa pun:
 * CSS-nya memang jatuh ke `:root` (yang sekarang Mono), tapi pemilih tema di
 * Pengaturan tampil kosong dan tombol putar tema mulai dari awal daftar.
 */
const RETIRED_THEMES: Record<string, ThemeName> = { warm: "mono", noir: "mono" };

function migrateTheme(state: AppState): AppState {
  const next = RETIRED_THEMES[state.settings.theme as string];
  if (!next) return state;
  return { ...state, settings: { ...state.settings, theme: next } };
}

/**
 * Membuang nominal yang tidak masuk akal dari data yang dibaca.
 *
 * Backup yang dipulihkan bisa berisi apa saja: berkas dari versi lama, hasil
 * suntingan tangan, atau — yang paling mungkin — nominal `Infinity` yang
 * ditulis versi sebelum batas nominal ada. `JSON.stringify(Infinity)`
 * menghasilkan `null`, jadi setelah sekali putaran backup nilainya kembali
 * sebagai `null` dan membuat seluruh total menjadi `NaN`. Sekali `NaN` masuk,
 * setiap angka di aplikasi ikut rusak dan tidak ada cara memulihkannya.
 *
 * Karena itu penyaringan dilakukan di sini, di pintu masuk — bukan di setiap
 * tempat yang menjumlahkan.
 */
function sanitizeAmounts(state: AppState): AppState {
  return {
    ...state,
    transactions: state.transactions
      .map((t) => ({ ...t, amount: clampAmount(t.amount) }))
      .filter((t) => t.amount > 0),
    goals: state.goals.map((g) => ({
      ...g,
      target: clampAmount(g.target),
      deposits: g.deposits
        .map((d) => ({ ...d, amount: clampAmount(d.amount) }))
        .filter((d) => d.amount > 0),
    })),
    budgets: state.budgets.map((b) => ({ ...b, limit: clampAmount(b.limit) })),
  };
}

/**
 * Versi awal template memakai id seperti `tx-abc123`. Sekarang semuanya uuid,
 * supaya id tetap unik kalau dua perangkat digabung lewat Import JSON.
 */
function migrateIds(state: AppState): AppState {
  const needsMigration =
    state.transactions.some((t) => !isUuid(t.id)) ||
    state.goals.some((g) => !isUuid(g.id) || g.deposits.some((d) => !isUuid(d.id)));

  if (!needsMigration) return state;

  return {
    ...state,
    transactions: state.transactions.map((t) => (isUuid(t.id) ? t : { ...t, id: newId() })),
    goals: state.goals.map((g) => ({
      ...g,
      id: isUuid(g.id) ? g.id : newId(),
      deposits: g.deposits.map((d) => (isUuid(d.id) ? d : { ...d, id: newId() })),
    })),
  };
}

/**
 * Membuka aplikasi dengan `?demo` memaksa dataset contoh dimuat.
 *
 * Gunanya satu: memberi tautan yang bisa dicoba calon pembeli tanpa perlu
 * memasang deployment kedua yang harus dirawat terpisah.
 *
 * Aman dipakai berdampingan dengan pengguna sungguhan, karena nilainya hanya
 * dipakai ketika penyimpanan benar-benar kosong — pengguna yang sudah punya
 * catatan tidak akan pernah tertimpa, bahkan kalau tautan itu tidak sengaja
 * mereka buka.
 */
function demoRequested(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return new URLSearchParams(window.location.search).has("demo");
  } catch {
    return false;
  }
}

let hydrationStarted = false;

export function hydrateStore() {
  if (hydrationStarted) return;
  hydrationStarted = true;

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    // Kunjungan pertama: tampilkan dataset demo supaya template langsung hidup.
    // Bisa dimatikan lewat config untuk pemasangan ke pengguna sungguhan, dan
    // dinyalakan per-kunjungan lewat `?demo` untuk tautan pratinjau.
    const wantsDemo = DEMO_DATA_ON_FIRST_RUN || demoRequested();
    const stored = raw ? reconcile(JSON.parse(raw)) : null;

    /*
     * Dianggap kosong kalau tidak ada catatan sama sekali.
     *
     * Membuka aplikasi sekali saja sudah menulis state kosong ke penyimpanan,
     * jadi kalau syaratnya cuma "belum ada data tersimpan", tautan `?demo`
     * gagal memuat apa pun begitu pengunjung sempat membuka URL polosnya lebih
     * dulu — persis kasus yang paling sering terjadi saat tautan dibagikan.
     *
     * Anggaran bawaan sengaja tidak ikut dihitung: itu ada sejak awal dan bukan
     * hasil ketikan siapa pun. Yang dijaga adalah transaksi dan target
     * tabungan — begitu salah satunya terisi, tidak ada yang boleh menimpanya.
     */
    const blank = !stored || (!stored.transactions.length && !stored.goals.length);

    const next = wantsDemo && blank ? buildSeedState() : (stored ?? emptyState());
    commit(next, !raw || (wantsDemo && blank));
  } catch {
    // Data tersimpan rusak. Tampilkan sesuatu, tapi JANGAN menyimpan —
    // menimpanya akan menghapus satu-satunya sisa yang mungkin masih bisa
    // diselamatkan pengguna secara manual dari penyimpanan browser.
    commit(DEMO_DATA_ON_FIRST_RUN ? buildSeedState() : emptyState(), false);
  }

  applyTheme(snapshot.state.settings.theme);

  /*
   * Minta status penyimpanan permanen begitu aplikasi hidup.
   *
   * Tanpa ini penyimpanan situs berstatus "best effort" dan boleh dibuang
   * browser saat ruang perangkat menipis — mode kegagalan yang paling merusak
   * kepercayaan, karena terjadi diam-diam dan tidak bisa dipulihkan. Sengaja
   * tidak di-await: hasilnya tidak mengubah apa pun yang dirender sekarang.
   */
  void requestPersistence();
}

const THEME_COLORS: Record<string, string> = {
  mono: "#f5f5f4",
  midnight: "#0d1230",
  glass: "#0b1024",
};

export function applyTheme(theme: Settings["theme"]) {
  if (typeof document === "undefined") return;
  document.documentElement.dataset.theme = theme;
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute("content", THEME_COLORS[theme] ?? THEME_COLORS.mono);
}

/* ==========================================================================
   Hooks
   ========================================================================== */

export function useStore(): Snapshot {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

export function useHydration() {
  useEffect(() => {
    hydrateStore();
  }, []);
}

/* ==========================================================================
   Actions
   ========================================================================== */

export { newId };

export const actions = {
  addTransaction(input: Omit<Transaction, "id" | "createdAt">) {
    const tx: Transaction = { ...input, id: newId(), createdAt: Date.now() };
    update((s) => ({ ...s, transactions: [...s.transactions, tx] }));
    return tx;
  },

  updateTransaction(id: string, patch: Partial<Omit<Transaction, "id">>) {
    update((s) => ({
      ...s,
      transactions: s.transactions.map((t) => (t.id === id ? { ...t, ...patch } : t)),
    }));
  },

  deleteTransaction(id: string) {
    update((s) => ({ ...s, transactions: s.transactions.filter((t) => t.id !== id) }));
  },

  /** Penambahan massal dari importer — satu commit, bukan satu per baris. */
  addTransactions(list: Transaction[]) {
    if (!list.length) return;
    update((s) => ({ ...s, transactions: [...s.transactions, ...list] }));
  },

  /** Mengembalikan transaksi yang baru dihapus — menyalakan tombol Urungkan. */
  restoreTransaction(tx: Transaction) {
    update((s) => ({ ...s, transactions: [...s.transactions, tx] }));
  },

  setBudget(categoryId: string, limit: number) {
    update((s) => {
      const exists = s.budgets.some((b) => b.categoryId === categoryId);
      const budgets: Budget[] = exists
        ? s.budgets.map((b) => (b.categoryId === categoryId ? { ...b, limit } : b))
        : [...s.budgets, { categoryId, limit }];
      return { ...s, budgets };
    });
  },

  removeBudget(categoryId: string) {
    update((s) => ({ ...s, budgets: s.budgets.filter((b) => b.categoryId !== categoryId) }));
  },

  addGoal(input: Omit<Goal, "id" | "deposits">) {
    const goal: Goal = { ...input, id: newId(), deposits: [] };
    update((s) => ({ ...s, goals: [...s.goals, goal] }));
    return goal;
  },

  updateGoal(id: string, patch: Partial<Omit<Goal, "id" | "deposits">>) {
    update((s) => ({ ...s, goals: s.goals.map((g) => (g.id === id ? { ...g, ...patch } : g)) }));
  },

  deleteGoal(id: string) {
    update((s) => ({ ...s, goals: s.goals.filter((g) => g.id !== id) }));
  },

  addDeposit(goalId: string, input: Omit<Deposit, "id">) {
    const deposit: Deposit = { ...input, id: newId() };
    update((s) => ({
      ...s,
      goals: s.goals.map((g) =>
        g.id === goalId ? { ...g, deposits: [...g.deposits, deposit] } : g,
      ),
    }));
    return deposit;
  },

  deleteDeposit(goalId: string, depositId: string) {
    update((s) => ({
      ...s,
      goals: s.goals.map((g) =>
        g.id === goalId ? { ...g, deposits: g.deposits.filter((d) => d.id !== depositId) } : g,
      ),
    }));
  },

  setSettings(patch: Partial<Settings>) {
    update((s) => ({ ...s, settings: { ...s.settings, ...patch } }));
    if (patch.theme) applyTheme(patch.theme);
  },

  /*
   * Tiga tindakan di bawah menghapus catatan yang sudah ada, dan ketiganya
   * hanya berjarak satu ketukan. Masing-masing menyimpan snapshot lebih dulu
   * supaya salah tekan bisa diurungkan — lihat `undoLast`.
   */

  /**
   * Dipakai Impor dan Pulihkan dari JSON di tab Pengaturan.
   *
   * @returns false kalau snapshot urungkan gagal disimpan, sehingga tindakan
   * ini TIDAK bisa dibatalkan. Pemanggil harus mengatakannya apa adanya —
   * menjanjikan tombol Urungkan yang tidak ada adalah cara pasti kehilangan
   * kepercayaan pengguna.
   */
  replaceState(next: AppState, label = "Ganti seluruh data"): boolean {
    const undoable = saveUndo(snapshot.state, label);
    /*
     * Wajib disaring, bukan opsional.
     *
     * Isi berkas backup sepenuhnya di luar kendali kita — bisa dari versi lama,
     * hasil suntingan tangan, atau memuat `null` karena `JSON.stringify`
     * mengubah `Infinity` menjadi itu. Tanpa saringan ini satu berkas cacat
     * cukup untuk membuat seluruh angka di aplikasi menjadi `NaN`, dan justru
     * inilah jalur yang dipakai orang ketika sedang panik kehilangan data.
     */
    const safe = sanitizeAmounts(next);
    commit(safe);
    applyTheme(safe.settings.theme);
    return undoable;
  },

  loadDemoData(): boolean {
    const undoable = saveUndo(snapshot.state, "Muat ulang data demo");
    const seeded = buildSeedState();
    commit({ ...seeded, settings: snapshot.state.settings });
    return undoable;
  },

  clearAll(): boolean {
    const undoable = saveUndo(snapshot.state, "Hapus semua data");
    const cleared = emptyState();
    commit({ ...cleared, settings: snapshot.state.settings });
    return undoable;
  },

  /**
   * Mengembalikan keadaan sebelum tindakan merusak terakhir.
   *
   * Snapshot dibuang setelah dipakai, jadi tombolnya tidak berubah menjadi
   * saklar bolak-balik yang justru membingungkan.
   */
  undoLast(): boolean {
    const snap = readUndo();
    if (!snap) return false;

    commit({ ...snap.state, settings: snapshot.state.settings });
    applyTheme(snapshot.state.settings.theme);
    clearUndo();
    return true;
  },
};
