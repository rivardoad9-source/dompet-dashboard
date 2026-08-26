import { EXPENSE_CATEGORIES, getCategory } from "./categories";
import { budgetStatus, clampPct, monthLabel, monthsUntil } from "./format";
import type { AppState, Budget, BudgetStatus, Goal, Transaction } from "./types";

export function inMonth(transactions: Transaction[], key: string): Transaction[] {
  return transactions.filter((t) => t.date.slice(0, 7) === key);
}

export function sumBy(transactions: Transaction[], type: "in" | "out"): number {
  return transactions.reduce((s, t) => (t.type === type ? s + t.amount : s), 0);
}

export interface MonthTotals {
  income: number;
  expense: number;
  net: number;
}

export function monthTotals(transactions: Transaction[], key: string): MonthTotals {
  const rows = inMonth(transactions, key);
  const income = sumBy(rows, "in");
  const expense = sumBy(rows, "out");
  return { income, expense, net: income - expense };
}

export function totalSaved(goals: Goal[]): number {
  return goals.reduce((s, g) => s + g.deposits.reduce((a, d) => a + d.amount, 0), 0);
}

/**
 * Cash you can actually spend right now: everything earned, minus everything
 * spent, minus what you've already parked in savings goals.
 */
export function liquidBalance(state: AppState): number {
  return (
    sumBy(state.transactions, "in") - sumBy(state.transactions, "out") - totalSaved(state.goals)
  );
}

export interface BudgetRow {
  categoryId: string;
  label: string;
  colorVar: string;
  limit: number;
  spent: number;
  pct: number;
  remaining: number;
  status: BudgetStatus;
  txCount: number;
}

export interface BudgetSummary {
  rows: BudgetRow[];
  /** Only spending that falls inside a budgeted category. */
  spent: number;
  /** Total spending this month, budgeted or not. */
  spentAll: number;
  limit: number;
  pct: number;
  remaining: number;
  status: BudgetStatus;
  overCount: number;
}

export function budgetSummary(
  transactions: Transaction[],
  budgets: Budget[],
  key: string,
): BudgetSummary {
  const rows = inMonth(transactions, key).filter((t) => t.type === "out");

  const spendByCat = new Map<string, { amount: number; count: number }>();
  for (const t of rows) {
    const entry = spendByCat.get(t.categoryId) ?? { amount: 0, count: 0 };
    entry.amount += t.amount;
    entry.count += 1;
    spendByCat.set(t.categoryId, entry);
  }

  const budgetRows: BudgetRow[] = budgets.map((b) => {
    const cat = getCategory(b.categoryId);
    const entry = spendByCat.get(b.categoryId) ?? { amount: 0, count: 0 };
    const pct = b.limit > 0 ? (entry.amount / b.limit) * 100 : 0;
    return {
      categoryId: b.categoryId,
      label: cat.label,
      colorVar: cat.colorVar,
      limit: b.limit,
      spent: entry.amount,
      pct,
      remaining: b.limit - entry.amount,
      status: budgetStatus(pct),
      txCount: entry.count,
    };
  });

  budgetRows.sort((a, b) => b.pct - a.pct);

  const spent = budgetRows.reduce((s, r) => s + r.spent, 0);
  const spentAll = rows.reduce((s, t) => s + t.amount, 0);
  const limit = budgetRows.reduce((s, r) => s + r.limit, 0);
  const pct = limit > 0 ? (spent / limit) * 100 : 0;

  return {
    rows: budgetRows,
    spent,
    spentAll,
    limit,
    pct,
    remaining: limit - spent,
    status: budgetStatus(pct),
    overCount: budgetRows.filter((r) => r.status === "over").length,
  };
}

export interface CategorySlice {
  categoryId: string;
  label: string;
  colorVar: string;
  amount: number;
  share: number;
  count: number;
}

/** Expense breakdown for one month, biggest first. */
export function categoryBreakdown(transactions: Transaction[], key: string): CategorySlice[] {
  const rows = inMonth(transactions, key).filter((t) => t.type === "out");
  const total = rows.reduce((s, t) => s + t.amount, 0);
  const map = new Map<string, { amount: number; count: number }>();
  for (const t of rows) {
    const e = map.get(t.categoryId) ?? { amount: 0, count: 0 };
    e.amount += t.amount;
    e.count += 1;
    map.set(t.categoryId, e);
  }
  return [...map.entries()]
    .map(([categoryId, e]) => {
      const cat = getCategory(categoryId);
      return {
        categoryId,
        label: cat.label,
        colorVar: cat.colorVar,
        amount: e.amount,
        share: total > 0 ? (e.amount / total) * 100 : 0,
        count: e.count,
      };
    })
    .sort((a, b) => b.amount - a.amount);
}

export interface TrendPoint {
  key: string;
  label: string;
  income: number;
  expense: number;
  net: number;
}

export function monthlyTrend(transactions: Transaction[], keys: string[]): TrendPoint[] {
  return keys.map((key) => {
    const { income, expense, net } = monthTotals(transactions, key);
    return { key, label: monthLabel(key, true), income, expense, net };
  });
}

export interface DaySummary {
  /** 1 sampai jumlah hari pada bulan itu. */
  day: number;
  /** `YYYY-MM-DD`, dipakai sebagai kunci React dan untuk menyaring transaksi. */
  iso: string;
  income: number;
  expense: number;
  count: number;
}

/**
 * Satu entri per hari dalam sebulan, termasuk hari yang kosong.
 *
 * Hari kosong sengaja tetap dikembalikan: kalender harus punya kotak untuk
 * setiap tanggal, dan grafik laju butuh titik untuk setiap hari supaya garisnya
 * tidak melompat.
 */
export function dailySummary(transactions: Transaction[], key: string): DaySummary[] {
  const [y, m] = key.split("-").map(Number);
  const days = new Date(y, m, 0).getDate();

  const out: DaySummary[] = Array.from({ length: days }, (_, i) => ({
    day: i + 1,
    iso: `${key}-${String(i + 1).padStart(2, "0")}`,
    income: 0,
    expense: 0,
    count: 0,
  }));

  for (const t of inMonth(transactions, key)) {
    const d = Number(t.date.slice(8, 10));
    if (d < 1 || d > days) continue;
    const entry = out[d - 1];
    if (t.type === "in") entry.income += t.amount;
    else entry.expense += t.amount;
    entry.count += 1;
  }

  return out;
}

/**
 * Cumulative spend per day for the month — feeds the pacing sparkline.
 *
 * Dibangun di atas `dailySummary` supaya tidak ada dua tempat yang menghitung
 * pengeluaran harian dan berpotensi menyimpang satu sama lain.
 */
export function dailyBurn(transactions: Transaction[], key: string) {
  let running = 0;
  return dailySummary(transactions, key).map((d) => {
    running += d.expense;
    return { day: d.day, amount: d.expense, cumulative: running };
  });
}

export interface GoalProgress {
  saved: number;
  pct: number;
  remaining: number;
  monthsLeft: number;
  /** Monthly deposit needed to hit the target on time. */
  suggested: number;
  done: boolean;
}

export function goalProgress(goal: Goal): GoalProgress {
  const saved = goal.deposits.reduce((s, d) => s + d.amount, 0);
  const remaining = Math.max(0, goal.target - saved);
  const monthsLeft = goal.deadline ? monthsUntil(goal.deadline) : 0;
  return {
    saved,
    pct: goal.target > 0 ? clampPct((saved / goal.target) * 100) : 0,
    remaining,
    monthsLeft,
    suggested: monthsLeft > 0 ? Math.ceil(remaining / monthsLeft / 50_000) * 50_000 : remaining,
    done: saved >= goal.target && goal.target > 0,
  };
}

/** Percentage change vs the previous month, or null when there's no baseline. */
export function deltaVsPrevious(
  transactions: Transaction[],
  key: string,
  prevKey: string,
  type: "in" | "out",
): number | null {
  const current = type === "in" ? monthTotals(transactions, key).income : monthTotals(transactions, key).expense;
  const previous =
    type === "in" ? monthTotals(transactions, prevKey).income : monthTotals(transactions, prevKey).expense;
  if (previous <= 0) return null;
  return ((current - previous) / previous) * 100;
}

/** Categories that have no budget row yet — offered in the "add budget" picker. */
export function unbudgetedCategories(budgets: Budget[]) {
  const used = new Set(budgets.map((b) => b.categoryId));
  return EXPENSE_CATEGORIES.filter((c) => !used.has(c.id));
}
