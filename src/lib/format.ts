import type { BudgetStatus } from "./types";

const IDR = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0,
});

const PLAIN = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 });

const MONTHS = [
  "Januari",
  "Februari",
  "Maret",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Agustus",
  "September",
  "Oktober",
  "November",
  "Desember",
];

const DAYS = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];

export const MASK = "Rp ••••••";

export function formatIDR(value: number, privacy = false): string {
  if (privacy) return MASK;
  return IDR.format(Math.round(value)).replace(/\s/g, " ");
}

/** `Rp 1,2 jt` — for tight spots like chart axes and stat chips. */
export function formatCompact(value: number, privacy = false): string {
  if (privacy) return "••••";
  const abs = Math.abs(value);
  const sign = value < 0 ? "-" : "";
  if (abs >= 1_000_000_000) return `${sign}Rp ${(abs / 1_000_000_000).toFixed(1).replace(".", ",")} M`;
  if (abs >= 1_000_000) return `${sign}Rp ${(abs / 1_000_000).toFixed(1).replace(".", ",")} jt`;
  if (abs >= 1_000) return `${sign}Rp ${Math.round(abs / 1_000)} rb`;
  return `${sign}Rp ${PLAIN.format(abs)}`;
}

/**
 * Ultra-short form for chart axes, where every pixel of width costs plot area.
 * `16 jt`, `4,5 jt`, `750 rb`, `0`.
 */
export function formatAxis(value: number, privacy = false): string {
  if (privacy) return "•••";
  const abs = Math.abs(value);
  const sign = value < 0 ? "-" : "";
  if (abs === 0) return "0";
  if (abs >= 1_000_000) {
    const n = abs / 1_000_000;
    const text = (n >= 10 ? Math.round(n).toString() : n.toFixed(1)).replace(/[.,]0$/, "").replace(".", ",");
    return `${sign}${text} jt`;
  }
  if (abs >= 1_000) return `${sign}${Math.round(abs / 1_000)} rb`;
  return `${sign}${Math.round(abs)}`;
}

/** Digits only, grouped — used inside the amount input. */
export function formatNumberInput(value: string): string {
  const digits = value.replace(/\D/g, "");
  if (!digits) return "";
  return PLAIN.format(Number(digits));
}

export function parseNumberInput(value: string): number {
  const digits = value.replace(/\D/g, "");
  return digits ? Number(digits) : 0;
}

/** `YYYY-MM` key used to bucket everything by month. */
export function monthKey(date: Date | string): string {
  const d = typeof date === "string" ? new Date(`${date}T00:00:00`) : date;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function monthLabel(key: string, short = false): string {
  const [y, m] = key.split("-").map(Number);
  const name = MONTHS[m - 1] ?? "";
  return short ? `${name.slice(0, 3)} ${String(y).slice(2)}` : `${name} ${y}`;
}

export function todayISO(): string {
  return toISO(new Date());
}

export function toISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

export function formatDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  return `${d.getDate()} ${MONTHS[d.getMonth()]?.slice(0, 3)} ${d.getFullYear()}`;
}

/** "Hari ini" / "Kemarin" / "Senin, 12 Mei" — used as transaction group headers. */
export function formatDateHuman(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.round((today.getTime() - d.getTime()) / 86_400_000);
  if (diff === 0) return "Hari ini";
  if (diff === 1) return "Kemarin";
  if (diff > 1 && diff < 7) return `${DAYS[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()].slice(0, 3)}`;
  return formatDate(iso);
}

/** Whole months between now and a deadline, floored at 1 so we never divide by zero. */
export function monthsUntil(deadlineISO: string): number {
  if (!deadlineISO) return 0;
  const now = new Date();
  const end = new Date(`${deadlineISO}T00:00:00`);
  const months =
    (end.getFullYear() - now.getFullYear()) * 12 + (end.getMonth() - now.getMonth());
  return Math.max(1, months);
}

export function clampPct(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, value));
}

/** PRD thresholds: <70% aman, 70–90% waspada, >90% overbudget. */
export function budgetStatus(pct: number): BudgetStatus {
  if (pct > 90) return "over";
  if (pct >= 70) return "warning";
  return "safe";
}

export const STATUS_META: Record<
  BudgetStatus,
  { label: string; colorVar: string; softVar: string }
> = {
  safe: { label: "Aman", colorVar: "--success", softVar: "--success-soft" },
  warning: { label: "Waspada", colorVar: "--warning", softVar: "--warning-soft" },
  over: { label: "Overbudget", colorVar: "--danger", softVar: "--danger-soft" },
};

/** Last `count` month keys, oldest first, ending at `from`. */
export function recentMonthKeys(count: number, from = new Date()): string[] {
  const keys: string[] = [];
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(from.getFullYear(), from.getMonth() - i, 1);
    keys.push(monthKey(d));
  }
  return keys;
}

export function shiftMonth(key: string, delta: number): string {
  const [y, m] = key.split("-").map(Number);
  return monthKey(new Date(y, m - 1 + delta, 1));
}
