"use client";

import { useEffect, useSyncExternalStore } from "react";
import { DEMO_DATA_ON_FIRST_RUN } from "./config";
import { clearUndo, readUndo, requestPersistence, saveUndo } from "./durability";
import { isUuid, newId } from "./ids";
import { buildSeedState, emptyState } from "./seed";
import type { AppState, Budget, Deposit, Goal, Settings, Transaction } from "./types";

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
}

const SERVER_SNAPSHOT: Snapshot = { state: emptyState(), hydrated: false };

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

function persist(state: AppState) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Mode privat / kuota penuh — aplikasi tetap jalan di memori sesi ini.
  }
}

function commit(next: AppState, save = true) {
  snapshot = { state: next, hydrated: true };
  if (save) persist(next);
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

  return migrateIds(state);
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

let hydrationStarted = false;

export function hydrateStore() {
  if (hydrationStarted) return;
  hydrationStarted = true;

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    // Kunjungan pertama: tampilkan dataset demo supaya template langsung hidup.
    // Bisa dimatikan lewat config untuk pemasangan ke pengguna sungguhan.
    const first = DEMO_DATA_ON_FIRST_RUN ? buildSeedState() : emptyState();
    const next = raw ? reconcile(JSON.parse(raw)) : first;
    commit(next, !raw);
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

export function applyTheme(theme: Settings["theme"]) {
  if (typeof document === "undefined") return;
  document.documentElement.dataset.theme = theme;
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute("content", theme === "midnight" ? "#0d1230" : "#fdfbf7");
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

  /** Dipakai Impor dan Pulihkan dari JSON di tab Pengaturan. */
  replaceState(next: AppState, label = "Ganti seluruh data") {
    saveUndo(snapshot.state, label);
    commit(next);
    applyTheme(next.settings.theme);
  },

  loadDemoData() {
    saveUndo(snapshot.state, "Muat ulang data demo");
    const seeded = buildSeedState();
    commit({ ...seeded, settings: snapshot.state.settings });
  },

  clearAll() {
    saveUndo(snapshot.state, "Hapus semua data");
    const cleared = emptyState();
    commit({ ...cleared, settings: snapshot.state.settings });
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
