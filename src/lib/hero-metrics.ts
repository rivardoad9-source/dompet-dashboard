import {
  ArrowDownLeft,
  ArrowUpRight,
  Scale,
  ShieldCheck,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { monthLabel } from "./format";
import type { HeroMetric } from "./types";

/**
 * Angka apa yang disorot di kartu utama Beranda.
 *
 * Saldo likuid bukan angka yang paling relevan untuk semua orang: yang sedang
 * menahan pengeluaran ingin melihat total keluar bulan ini, yang mengejar
 * surplus ingin melihat pemasukan dikurangi pengeluaran. Tabel ini yang
 * menentukan pilihannya.
 *
 * Tidak ada perhitungan baru di sini — seluruh angkanya sudah dihitung di
 * `stats.ts` dan cukup dibaca dari `HeroContext`. Menambah metrik berarti
 * menambah satu entri di bawah, tidak ada berkas lain yang perlu disentuh.
 */

/** Angka-angka yang sudah dihitung halaman Beranda, siap dibaca tabel ini. */
export interface HeroContext {
  /** Sepanjang waktu: pemasukan − pengeluaran − dana yang diparkir di tabungan. */
  balance: number;
  income: number;
  expense: number;
  net: number;
  budgetRemaining: number;
  budgetLimit: number;
}

export interface HeroStat {
  label: string;
  icon: LucideIcon;
  /** `month` mendapat sufiks bulan pada labelnya; `total` tidak. */
  scope: "total" | "month";
  value: (c: HeroContext) => number;
  /** Tampilkan tanda +/−. Hanya untuk angka yang wajar bernilai negatif. */
  signed?: boolean;
}

export interface HeroMetricDef extends HeroStat {
  id: HeroMetric;
  /** Kalimat penjelas di lembar pemilih. */
  hint: string;
  /**
   * Dua angka kecil di bawah angka besar.
   *
   * Ditulis eksplisit per metrik, bukan diturunkan otomatis, karena ada satu
   * aturan yang harus dijaga: pasangan tidak boleh memuat angka yang sedang
   * menjadi angka besar. Kartu yang menampilkan nominal sama dua kali terbaca
   * seperti bug.
   */
  companions: [HeroStat, HeroStat];
}

/* Dipakai berulang di beberapa metrik, jadi didefinisikan sekali. */
const MASUK: HeroStat = {
  label: "Masuk",
  icon: ArrowDownLeft,
  scope: "month",
  value: (c) => c.income,
};

const KELUAR: HeroStat = {
  label: "Keluar",
  icon: ArrowUpRight,
  scope: "month",
  value: (c) => c.expense,
};

const SISA: HeroStat = {
  label: "Sisa",
  icon: Scale,
  scope: "month",
  value: (c) => c.net,
  signed: true,
};

const REALISASI: HeroStat = {
  label: "Realisasi",
  icon: ArrowUpRight,
  scope: "month",
  value: (c) => c.expense,
};

const PLAFON: HeroStat = {
  label: "Plafon",
  icon: Wallet,
  scope: "month",
  value: (c) => c.budgetLimit,
};

export const HERO_METRICS: HeroMetricDef[] = [
  {
    id: "saldo",
    label: "Saldo likuid",
    icon: Wallet,
    scope: "total",
    hint: "Seluruh pemasukan dikurangi pengeluaran dan dana yang sudah diparkir di target tabungan.",
    value: (c) => c.balance,
    companions: [MASUK, KELUAR],
  },
  {
    id: "keluar",
    label: "Keluar",
    icon: ArrowUpRight,
    scope: "month",
    hint: "Total pengeluaran pada bulan yang sedang dipilih.",
    value: (c) => c.expense,
    companions: [MASUK, SISA],
  },
  {
    id: "masuk",
    label: "Masuk",
    icon: ArrowDownLeft,
    scope: "month",
    hint: "Total pemasukan pada bulan yang sedang dipilih.",
    value: (c) => c.income,
    companions: [KELUAR, SISA],
  },
  {
    id: "sisa",
    label: "Sisa",
    icon: Scale,
    scope: "month",
    signed: true,
    hint: "Pemasukan dikurangi pengeluaran bulan ini — surplus kalau positif, defisit kalau negatif.",
    value: (c) => c.net,
    companions: [MASUK, KELUAR],
  },
  {
    id: "anggaran",
    label: "Sisa anggaran",
    icon: ShieldCheck,
    scope: "month",
    // Tanpa `signed`: sisa anggaran yang positif adalah keadaan normal, jadi
    // tanda plus di depannya cuma derau. Kalau plafon terlampaui angkanya
    // negatif, dan `formatCompact` sudah menuliskan tanda minusnya sendiri.
    hint: "Sisa plafon seluruh kategori bulan ini. Negatif berarti sudah lewat batas.",
    value: (c) => c.budgetRemaining,
    companions: [REALISASI, PLAFON],
  },
];

const BY_ID = new Map(HERO_METRICS.map((m) => [m.id, m]));

/**
 * Selalu mengembalikan definisi yang bisa dipakai.
 *
 * Nilainya berasal dari pengaturan tersimpan milik pengguna, jadi bisa saja
 * menyebut metrik yang sudah dihapus dari tabel. Pola yang sama dipakai
 * `getCategory` di categories.ts — data lama tidak boleh membuat halaman gagal.
 */
export function getHeroMetric(id: HeroMetric): HeroMetricDef {
  return BY_ID.get(id) ?? HERO_METRICS[0];
}

/** Label lengkap, dengan sufiks bulan untuk metrik yang terikat bulan. */
export function heroLabel(stat: HeroStat, key: string): string {
  return stat.scope === "month" ? `${stat.label} · ${monthLabel(key, true)}` : stat.label;
}
