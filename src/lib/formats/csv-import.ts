import { EXPENSE_CATEGORIES, INCOME_CATEGORIES } from "../categories";
import { newId } from "../ids";
import type { Transaction, TxType } from "../types";

/**
 * Membaca file CSV/TSV dari aplikasi keuangan lain.
 *
 * Tidak ada standar untuk ekspor pencatat keuangan: pemisah kolomnya bisa koma,
 * titik koma, atau tab; nominalnya bisa "Rp 25.000", "25,000.00", atau
 * "(25.000)"; tanggalnya bisa DD/MM/YYYY, MM/DD/YYYY, atau "12 Jan 2026"; dan
 * arah uang bisa berupa tanda minus, kolom terpisah, atau kata seperti
 * "Debit"/"Pengeluaran"/"Expense".
 *
 * Modul ini menebak semuanya, lalu menyerahkan hasil tebakan ke pengguna untuk
 * dikoreksi sebelum apa pun disimpan. Menebak diam-diam pada data keuangan
 * adalah cara tercepat merusak catatan orang.
 */

/* ==========================================================================
   Pembacaan berkas
   ========================================================================== */

const DELIMITERS = [",", ";", "\t", "|"] as const;

/** Memilih pemisah yang menghasilkan jumlah kolom paling konsisten. */
export function detectDelimiter(text: string): string {
  const sample = text.split(/\r?\n/).filter((l) => l.trim()).slice(0, 20);
  if (!sample.length) return ",";

  let best = ",";
  let bestScore = -1;

  for (const d of DELIMITERS) {
    const counts = sample.map((line) => splitLine(line, d).length);
    const max = Math.max(...counts);
    if (max < 2) continue;
    // Konsisten = semua baris punya jumlah kolom sama.
    const consistent = counts.filter((c) => c === max).length / counts.length;
    const score = consistent * 10 + max;
    if (score > bestScore) {
      bestScore = score;
      best = d;
    }
  }
  return best;
}

/** Pemecah satu baris yang menghormati tanda kutip dan kutip ganda di dalamnya. */
function splitLine(line: string, delimiter: string): string[] {
  const out: string[] = [];
  let cur = "";
  let quoted = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          quoted = false;
        }
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      quoted = true;
    } else if (ch === delimiter) {
      out.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out.map((c) => c.trim());
}

export interface ParsedSheet {
  headers: string[];
  rows: string[][];
  delimiter: string;
}

export function parseDelimited(text: string): ParsedSheet {
  const clean = text.replace(/^﻿/, ""); // buang BOM
  const delimiter = detectDelimiter(clean);

  const lines = clean.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (!lines.length) return { headers: [], rows: [], delimiter };

  const headers = splitLine(lines[0], delimiter);
  const rows = lines.slice(1).map((l) => splitLine(l, delimiter));

  return { headers, rows, delimiter };
}

/* ==========================================================================
   Nominal
   ========================================================================== */

/**
 * Mengubah teks nominal apa pun menjadi angka.
 *
 * Kasus sulitnya adalah "25.000" — di Indonesia itu dua puluh lima ribu, di
 * Inggris itu dua puluh lima koma nol. Aturannya: kalau ada dua jenis pemisah,
 * yang muncul terakhir adalah desimal. Kalau hanya satu jenis dan diikuti tepat
 * dua digit di ujung, itu desimal; selain itu pemisah ribuan.
 */
export function parseAmount(raw: string): number | null {
  if (!raw) return null;

  let s = raw.trim();
  if (!s) return null;

  // (1.234) adalah notasi akuntansi untuk negatif.
  const parenNegative = /^\(.*\)$/.test(s);
  if (parenNegative) s = s.slice(1, -1);

  const explicitNegative = /^-/.test(s) || /-$/.test(s);

  // Buang simbol mata uang, spasi, dan tanda minus.
  s = s.replace(/[^\d.,]/g, "");
  if (!s) return null;

  const lastDot = s.lastIndexOf(".");
  const lastComma = s.lastIndexOf(",");

  let normalized: string;
  if (lastDot >= 0 && lastComma >= 0) {
    const decimalSep = lastDot > lastComma ? "." : ",";
    const thousandSep = decimalSep === "." ? "," : ".";
    normalized = s.split(thousandSep).join("").replace(decimalSep, ".");
  } else if (lastDot >= 0 || lastComma >= 0) {
    const sep = lastDot >= 0 ? "." : ",";
    const idx = lastDot >= 0 ? lastDot : lastComma;
    const tail = s.length - idx - 1;
    const occurrences = s.split(sep).length - 1;
    // Satu pemisah dengan tepat 2 digit di belakangnya = desimal.
    normalized = occurrences === 1 && tail === 2 ? s.replace(sep, ".") : s.split(sep).join("");
  } else {
    normalized = s;
  }

  const value = Number(normalized);
  if (!Number.isFinite(value)) return null;

  return parenNegative || explicitNegative ? -value : value;
}

/* ==========================================================================
   Tanggal
   ========================================================================== */

const MONTH_WORDS: Record<string, number> = {
  jan: 1, januari: 1, january: 1,
  feb: 2, februari: 2, february: 2, peb: 2,
  mar: 3, maret: 3, march: 3,
  apr: 4, april: 4,
  mei: 5, may: 5,
  jun: 6, juni: 6, june: 6,
  jul: 7, juli: 7, july: 7,
  agu: 8, ags: 8, agustus: 8, aug: 8, august: 8,
  sep: 9, sept: 9, september: 9,
  okt: 10, oktober: 10, oct: 10, october: 10,
  nov: 11, november: 11,
  des: 12, desember: 12, dec: 12, december: 12,
};

function iso(y: number, m: number, d: number): string | null {
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  if (y < 1900 || y > 2200) return null;
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/**
 * @param dayFirst hasil analisis seluruh kolom — lihat `detectDayFirst`.
 */
export function parseDate(raw: string, dayFirst: boolean): string | null {
  if (!raw) return null;
  const s = raw.trim();
  if (!s) return null;

  // 2026-08-24 atau 2026/08/24
  const isoMatch = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (isoMatch) return iso(+isoMatch[1], +isoMatch[2], +isoMatch[3]);

  // 24/08/2026, 24-08-26
  const numeric = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})/);
  if (numeric) {
    const a = +numeric[1];
    const b = +numeric[2];
    let y = +numeric[3];
    if (y < 100) y += y < 70 ? 2000 : 1900;
    const [d, m] = dayFirst ? [a, b] : [b, a];
    return iso(y, m, d);
  }

  // 24 Agustus 2026 / 24 Aug 26
  const worded = s.match(/^(\d{1,2})\s+([A-Za-z]+)\.?\s+(\d{2,4})/);
  if (worded) {
    const m = MONTH_WORDS[worded[2].toLowerCase()];
    let y = +worded[3];
    if (y < 100) y += y < 70 ? 2000 : 1900;
    if (m) return iso(y, m, +worded[1]);
  }

  // Aug 24, 2026
  const usWorded = s.match(/^([A-Za-z]+)\.?\s+(\d{1,2}),?\s+(\d{4})/);
  if (usWorded) {
    const m = MONTH_WORDS[usWorded[1].toLowerCase()];
    if (m) return iso(+usWorded[3], m, +usWorded[2]);
  }

  // Terakhir: serahkan ke parser bawaan (menangani ISO dengan jam, dll).
  const fallback = new Date(s);
  if (!Number.isNaN(fallback.getTime())) {
    return iso(fallback.getFullYear(), fallback.getMonth() + 1, fallback.getDate());
  }

  return null;
}

/**
 * Menentukan urutan hari/bulan dengan melihat SELURUH kolom, bukan per baris.
 *
 * Satu nilai seperti "05/03/2026" tidak bisa dipastikan. Tapi kalau ada baris
 * lain di kolom yang sama berbunyi "24/03/2026", angka pertama jelas hari —
 * dan kesimpulan itu berlaku untuk seluruh kolom.
 */
export function detectDayFirst(values: string[]): boolean {
  let firstOver12 = 0;
  let secondOver12 = 0;

  for (const v of values) {
    const m = v.trim().match(/^(\d{1,2})[-/.](\d{1,2})[-/.]/);
    if (!m) continue;
    if (+m[1] > 12) firstOver12++;
    if (+m[2] > 12) secondOver12++;
  }

  if (firstOver12 > secondOver12) return true;
  if (secondOver12 > firstOver12) return false;
  return true; // Format Indonesia adalah hari dulu.
}

/* ==========================================================================
   Menebak pemetaan kolom
   ========================================================================== */

export interface ColumnMapping {
  date: number;
  amount: number;
  /** Kolom terpisah untuk pemasukan; -1 kalau tidak ada. */
  amountIn: number;
  category: number;
  note: number;
  /** Kolom yang berisi kata seperti "Pengeluaran"/"Income"; -1 kalau tidak ada. */
  type: number;
}

const HINTS = {
  date: ["tanggal", "tgl", "date", "waktu", "time", "datetime"],
  amount: ["nominal", "jumlah", "amount", "nilai", "value", "total", "debit", "keluar", "pengeluaran", "expense", "harga"],
  amountIn: ["kredit", "credit", "masuk", "pemasukan", "income", "deposit"],
  category: ["kategori", "category", "kategory", "jenis", "pos", "akun", "account", "label", "tag"],
  note: ["catatan", "keterangan", "uraian", "deskripsi", "description", "note", "notes", "memo", "detail", "judul", "title", "nama", "merchant", "payee", "item", "transaksi"],
  type: ["tipe", "type", "arah", "jenis transaksi", "transaction type", "in/out", "dc"],
};

function scoreHeader(header: string, hints: string[]): number {
  const h = header.toLowerCase().trim();
  if (!h) return 0;
  for (const hint of hints) {
    if (h === hint) return 100;
    if (h.includes(hint)) return 60;
  }
  return 0;
}

export function guessMapping(sheet: ParsedSheet): ColumnMapping {
  const pick = (hints: string[], exclude: number[] = []): number => {
    let best = -1;
    let bestScore = 0;
    sheet.headers.forEach((h, i) => {
      if (exclude.includes(i)) return;
      const s = scoreHeader(h, hints);
      if (s > bestScore) {
        bestScore = s;
        best = i;
      }
    });
    return best;
  };

  const date = pick(HINTS.date);
  const amountIn = pick(HINTS.amountIn, [date]);
  const amount = pick(HINTS.amount, [date, amountIn]);
  const type = pick(HINTS.type, [date, amount, amountIn]);
  const category = pick(HINTS.category, [date, amount, amountIn, type]);
  const note = pick(HINTS.note, [date, amount, amountIn, type, category]);

  return { date, amount, amountIn, category, note, type };
}

/* ==========================================================================
   Arah uang & kategori
   ========================================================================== */

const OUT_WORDS = ["keluar", "pengeluaran", "expense", "expenses", "debit", "debet", "spending", "beli", "bayar", "out", "dr"];
const IN_WORDS = ["masuk", "pemasukan", "income", "credit", "kredit", "deposit", "salary", "gaji", "in", "cr"];

function typeFromWord(raw: string): TxType | null {
  const s = raw.toLowerCase().trim();
  if (!s) return null;
  if (IN_WORDS.some((w) => s === w || s.includes(w))) return "in";
  if (OUT_WORDS.some((w) => s === w || s.includes(w))) return "out";
  return null;
}

/** Mencocokkan nama kategori bebas ke kategori bawaan aplikasi. */
export function matchCategory(raw: string, type: TxType): string {
  const s = raw.toLowerCase().trim();
  const pool = type === "in" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;

  if (s) {
    for (const c of pool) {
      if (c.label.toLowerCase() === s || c.id === s) return c.id;
    }
    for (const c of pool) {
      const first = c.label.toLowerCase().split(" ")[0];
      if (s.includes(first) || first.includes(s)) return c.id;
    }
    // Beberapa padanan yang sering muncul di aplikasi lain.
    const aliases: Record<string, string> = {
      food: "makanan", makan: "makanan", "food & drink": "makanan", groceries: "makanan",
      transport: "transport", transportation: "transport", travel: "transport", bensin: "transport",
      bill: "tagihan", bills: "tagihan", utilities: "tagihan", listrik: "tagihan", internet: "tagihan",
      entertainment: "hiburan", fun: "hiburan",
      shopping: "belanja", clothes: "belanja",
      health: "kesehatan", medical: "kesehatan",
      education: "pendidikan", school: "pendidikan",
      salary: "gaji", wage: "gaji",
      bonus: "bonus", gift: "hadiah",
    };
    const alias = aliases[s];
    if (alias && pool.some((c) => c.id === alias)) return alias;
  }

  return type === "in" ? "lain-masuk" : "lainnya";
}

/* ==========================================================================
   Membangun transaksi
   ========================================================================== */

export interface ImportPreview {
  transactions: Transaction[];
  /** Baris yang dilewati beserta alasannya, untuk ditampilkan ke pengguna. */
  skipped: Array<{ row: number; reason: string }>;
  dayFirst: boolean;
}

/**
 * Apakah tanda plus/minus di kolom nominal benar-benar menandakan arah uang?
 *
 * Kalau satu kolom berisi campuran positif dan negatif, tandanya jelas
 * bermakna: minus pengeluaran, plus pemasukan. Tapi banyak aplikasi mengekspor
 * semuanya positif dan menaruh arahnya di kolom lain — di situ tanda tidak
 * mengandung informasi apa pun dan tidak boleh dipakai menyimpulkan.
 */
function signIsMeaningful(values: string[]): boolean {
  let positives = 0;
  let negatives = 0;
  for (const v of values) {
    const n = parseAmount(v);
    if (n === null || n === 0) continue;
    if (n < 0) negatives++;
    else positives++;
  }
  return positives > 0 && negatives > 0;
}

/** Apakah teks kategori ini merujuk salah satu kategori pemasukan bawaan? */
function looksLikeIncomeCategory(raw: string): boolean {
  const s = raw.toLowerCase().trim();
  if (!s) return false;

  const incomeWords = ["gaji", "salary", "wage", "bonus", "thr", "freelance", "hadiah", "gift", "pemasukan", "income", "pendapatan", "refund"];
  if (incomeWords.some((w) => s.includes(w))) return true;

  return INCOME_CATEGORIES.some((c) => c.label.toLowerCase() === s || c.id === s);
}

export function buildTransactions(sheet: ParsedSheet, mapping: ColumnMapping): ImportPreview {
  const dateValues = mapping.date >= 0 ? sheet.rows.map((r) => r[mapping.date] ?? "") : [];
  const dayFirst = detectDayFirst(dateValues);

  const amountValues = mapping.amount >= 0 ? sheet.rows.map((r) => r[mapping.amount] ?? "") : [];
  const signMatters = signIsMeaningful(amountValues);

  const transactions: Transaction[] = [];
  const skipped: ImportPreview["skipped"] = [];
  const now = Date.now();

  sheet.rows.forEach((row, i) => {
    const cell = (idx: number) => (idx >= 0 ? (row[idx] ?? "").trim() : "");

    const date = mapping.date >= 0 ? parseDate(cell(mapping.date), dayFirst) : null;
    if (!date) {
      skipped.push({ row: i + 2, reason: "tanggal tidak terbaca" });
      return;
    }

    const primary = parseAmount(cell(mapping.amount));
    const secondary = mapping.amountIn >= 0 ? parseAmount(cell(mapping.amountIn)) : null;

    // Dua kolom terpisah (debit/kredit): yang terisi menentukan arahnya.
    let amount: number | null = null;
    let type: TxType | null = null;

    if (secondary !== null && secondary !== 0) {
      amount = Math.abs(secondary);
      type = "in";
    } else if (primary !== null && primary !== 0) {
      amount = Math.abs(primary);
      // Tanda hanya dipercaya kalau kolomnya memang bercampur plus dan minus.
      if (signMatters) type = primary < 0 ? "out" : "in";
    }

    if (amount === null || amount === 0) {
      skipped.push({ row: i + 2, reason: "nominal kosong atau nol" });
      return;
    }

    const categoryText = cell(mapping.category);

    // Urutan keyakinan: kolom tipe eksplisit > tanda > nama kategori.
    const wordType = mapping.type >= 0 ? typeFromWord(cell(mapping.type)) : null;
    if (wordType) {
      type = wordType;
    } else if (!type && looksLikeIncomeCategory(categoryText)) {
      // "Gaji" atau "Salary" jelas pemasukan walau semua nominal ditulis positif.
      type = "in";
    }

    // Tanpa petunjuk apa pun, anggap pengeluaran: itu mayoritas isi ekspor
    // aplikasi pencatat keuangan.
    if (!type) type = "out";

    transactions.push({
      id: newId(),
      type,
      amount,
      categoryId: matchCategory(categoryText, type),
      note: cell(mapping.note).slice(0, 80),
      date,
      createdAt: now + i,
    });
  });

  return { transactions, skipped, dayFirst };
}
