export type TxType = "in" | "out";

export type ThemeName = "noir" | "midnight" | "glass";

/** Angka besar yang disorot di kartu utama Beranda. Tabelnya di `hero-metrics.ts`. */
export type HeroMetric = "saldo" | "keluar" | "masuk" | "sisa" | "anggaran";

/**
 * Grafik yang tampil di kartu tengah Beranda.
 *
 * `laju` menjawab "apakah saya belanja terlalu cepat bulan ini";
 * `banding` menjawab "apakah bulan ini lebih boros dari biasanya";
 * `kalender` menjawab "hari apa saja saya mengeluarkan uang, dan berapa".
 */
export type HomeChart = "laju" | "banding" | "kalender";

export interface Transaction {
  id: string;
  type: TxType;
  /** Always a positive number. `type` carries the direction. */
  amount: number;
  categoryId: string;
  note: string;
  /** ISO date, `YYYY-MM-DD`. */
  date: string;
  createdAt: number;
}

/** Monthly spending ceiling ("plafon") for one expense category. */
export interface Budget {
  categoryId: string;
  limit: number;
}

export interface Deposit {
  id: string;
  amount: number;
  date: string;
  note: string;
}

export interface Goal {
  id: string;
  name: string;
  target: number;
  /** ISO date the goal should be reached by. Empty string = no deadline. */
  deadline: string;
  colorVar: string;
  deposits: Deposit[];
}

export interface Settings {
  name: string;
  theme: ThemeName;
  /** Hide every rupiah figure behind a mask — handy for demos and screenshots. */
  privacy: boolean;
  /** Which figure headlines the balance card on the home page. */
  heroMetric: HeroMetric;
  /** Which chart sits in the middle card on the home page. */
  homeChart: HomeChart;
  /**
   * Foto profil sebagai data URL, atau string kosong kalau memakai inisial.
   *
   * Disimpan langsung di dalam state karena ikut berpindah lewat backup JSON —
   * gambarnya diperkecil dulu saat dipilih (lihat `readAvatarFile`) supaya
   * tidak menghabiskan kuota localStorage.
   */
  avatar: string;
}

export interface AppState {
  transactions: Transaction[];
  budgets: Budget[];
  goals: Goal[];
  settings: Settings;
}

/** Budget health thresholds from the PRD: <70% aman, 70–90% waspada, >90% overbudget. */
export type BudgetStatus = "safe" | "warning" | "over";
