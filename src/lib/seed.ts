import { toISO } from "./format";
import { newId } from "./ids";
import type { AppState, Budget, Goal, Transaction } from "./types";

/** Deterministic PRNG so the demo dataset looks identical on every machine. */
function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const DEFAULT_BUDGETS: Budget[] = [
  { categoryId: "makanan", limit: 2_500_000 },
  { categoryId: "transport", limit: 800_000 },
  { categoryId: "tagihan", limit: 1_200_000 },
  { categoryId: "hiburan", limit: 600_000 },
  { categoryId: "belanja", limit: 1_000_000 },
  { categoryId: "kesehatan", limit: 400_000 },
  { categoryId: "pendidikan", limit: 500_000 },
  { categoryId: "lainnya", limit: 300_000 },
];

const EXPENSE_NOTES: Record<string, string[]> = {
  makanan: ["Kopi pagi", "Makan siang kantor", "Belanja bahan masak", "Gofood malam", "Nongkrong"],
  transport: ["Isi bensin", "Ojek online", "Tiket KRL", "Parkir", "Tol"],
  tagihan: ["Listrik", "Internet rumah", "Pulsa & kuota", "Air PDAM", "Langganan streaming"],
  hiburan: ["Nonton bioskop", "Spotify", "Main futsal", "Buku baru", "Konser"],
  belanja: ["Kaos baru", "Skincare", "Perabot dapur", "Sepatu lari", "Hadiah teman"],
  kesehatan: ["Vitamin", "Kontrol dokter", "Obat apotek", "Gym bulanan"],
  pendidikan: ["Kursus online", "Beli e-book", "Seminar", "Alat tulis"],
  lainnya: ["Donasi", "Biaya admin bank", "Servis motor", "Titip beli"],
};

const CATEGORY_WEIGHTS: Array<{ id: string; weight: number; min: number; max: number }> = [
  { id: "makanan", weight: 30, min: 18_000, max: 145_000 },
  { id: "transport", weight: 16, min: 12_000, max: 90_000 },
  { id: "tagihan", weight: 8, min: 90_000, max: 420_000 },
  { id: "hiburan", weight: 11, min: 25_000, max: 180_000 },
  { id: "belanja", weight: 14, min: 60_000, max: 380_000 },
  { id: "kesehatan", weight: 6, min: 35_000, max: 220_000 },
  { id: "pendidikan", weight: 7, min: 50_000, max: 300_000 },
  { id: "lainnya", weight: 8, min: 20_000, max: 150_000 },
];

const TOTAL_WEIGHT = CATEGORY_WEIGHTS.reduce((s, c) => s + c.weight, 0);

function pickCategory(r: number) {
  let acc = 0;
  const target = r * TOTAL_WEIGHT;
  for (const c of CATEGORY_WEIGHTS) {
    acc += c.weight;
    if (target <= acc) return c;
  }
  return CATEGORY_WEIGHTS[0];
}

function roundTo(value: number, step: number) {
  return Math.max(step, Math.round(value / step) * step);
}

/**
 * Six months of believable activity for a first-jobber in Indonesia.
 * Generated once on first run, then owned by the user in localStorage.
 */
export function buildSeedTransactions(now = new Date()): Transaction[] {
  const rand = mulberry32(20260823);
  const out: Transaction[] = [];
  const id = () => newId();

  for (let back = 5; back >= 0; back--) {
    const anchor = new Date(now.getFullYear(), now.getMonth() - back, 1);
    const year = anchor.getFullYear();
    const month = anchor.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const isCurrentMonth = back === 0;
    // Only fill the current month up to today, so "sisa anggaran" stays meaningful.
    const lastDay = isCurrentMonth ? now.getDate() : daysInMonth;

    // --- Pemasukan ---
    const payday = Math.min(25, lastDay);
    if (payday >= 1) {
      out.push({
        id: id(),
        type: "in",
        amount: 8_500_000,
        categoryId: "gaji",
        note: "Gaji bulanan",
        date: toISO(new Date(year, month, payday)),
        createdAt: new Date(year, month, payday, 9).getTime(),
      });
    }
    if (rand() > 0.45 && lastDay >= 12) {
      const day = 4 + Math.floor(rand() * Math.min(14, lastDay - 4));
      out.push({
        id: id(),
        type: "in",
        amount: roundTo(900_000 + rand() * 2_600_000, 50_000),
        categoryId: "freelance",
        note: "Proyek desain sampingan",
        date: toISO(new Date(year, month, Math.max(1, day))),
        createdAt: new Date(year, month, Math.max(1, day), 14).getTime(),
      });
    }
    if (back === 2 && lastDay >= 20) {
      out.push({
        id: id(),
        type: "in",
        amount: 4_250_000,
        categoryId: "bonus",
        note: "THR",
        date: toISO(new Date(year, month, 20)),
        createdAt: new Date(year, month, 20, 10).getTime(),
      });
    }

    // --- Pengeluaran ---
    const count = 34 + Math.floor(rand() * 14);
    const scaled = isCurrentMonth ? Math.round((count * lastDay) / daysInMonth) : count;
    for (let i = 0; i < scaled; i++) {
      const cat = pickCategory(rand());
      const day = 1 + Math.floor(rand() * lastDay);
      const notes = EXPENSE_NOTES[cat.id] ?? ["Pengeluaran"];
      out.push({
        id: id(),
        type: "out",
        amount: roundTo(cat.min + rand() * (cat.max - cat.min), 1_000),
        categoryId: cat.id,
        note: notes[Math.floor(rand() * notes.length)],
        date: toISO(new Date(year, month, Math.min(day, lastDay))),
        createdAt: new Date(year, month, Math.min(day, lastDay), 8 + Math.floor(rand() * 12)).getTime(),
      });
    }
  }

  return out.sort((a, b) => (a.date === b.date ? a.createdAt - b.createdAt : a.date.localeCompare(b.date)));
}

export function buildSeedGoals(now = new Date()): Goal[] {
  const y = now.getFullYear();
  const mk = (monthsAhead: number) => toISO(new Date(y, now.getMonth() + monthsAhead, 1));
  const past = (monthsBack: number, day = 25) =>
    toISO(new Date(y, now.getMonth() - monthsBack, day));

  return [
    {
      id: newId(),
      name: "Dana Darurat",
      target: 30_000_000,
      deadline: mk(14),
      colorVar: "--cat-3",
      deposits: [
        { id: newId(), amount: 2_500_000, date: past(5), note: "Setoran awal" },
        { id: newId(), amount: 1_500_000, date: past(4), note: "Sisa gaji" },
        { id: newId(), amount: 1_500_000, date: past(3), note: "Sisa gaji" },
        { id: newId(), amount: 1_500_000, date: past(2), note: "Bonus THR" },
        { id: newId(), amount: 1_500_000, date: past(1), note: "Sisa gaji" },
      ],
    },
    {
      id: newId(),
      name: "Tabungan Nikah",
      target: 80_000_000,
      deadline: mk(26),
      colorVar: "--cat-5",
      deposits: [
        { id: newId(), amount: 2_500_000, date: past(5, 26), note: "Patungan" },
        { id: newId(), amount: 2_000_000, date: past(3, 26), note: "Patungan" },
        { id: newId(), amount: 2_500_000, date: past(2, 26), note: "THR" },
        { id: newId(), amount: 2_000_000, date: past(1, 26), note: "Patungan" },
      ],
    },
    {
      id: newId(),
      name: "Liburan Bali",
      target: 12_000_000,
      deadline: mk(6),
      colorVar: "--cat-4",
      deposits: [
        { id: newId(), amount: 1_200_000, date: past(4, 27), note: "Nabung rutin" },
        { id: newId(), amount: 1_400_000, date: past(2, 27), note: "Nabung rutin" },
        { id: newId(), amount: 1_600_000, date: past(1, 27), note: "Freelance" },
      ],
    },
  ];
}

export function buildSeedState(now = new Date()): AppState {
  return {
    transactions: buildSeedTransactions(now),
    budgets: DEFAULT_BUDGETS,
    goals: buildSeedGoals(now),
    settings: { name: "Rivardo", theme: "warm", privacy: false, heroMetric: "saldo", homeChart: "laju", avatar: "" },
  };
}

export function emptyState(): AppState {
  return {
    transactions: [],
    budgets: DEFAULT_BUDGETS,
    goals: [],
    settings: { name: "Kamu", theme: "warm", privacy: false, heroMetric: "saldo", homeChart: "laju", avatar: "" },
  };
}
