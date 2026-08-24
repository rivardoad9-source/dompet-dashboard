"use client";

import { Download, Filter, Search, X } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState } from "react";
import { CATEGORIES, getCategory } from "@/lib/categories";
import { formatCompact, monthLabel } from "@/lib/format";
import { useCurrentMonth } from "@/lib/hooks";
import { exportTransactionsCsv } from "@/lib/export";
import { useStore } from "@/lib/store";
import type { TxType } from "@/lib/types";
import { PageIntro } from "@/components/shell/AppShell";
import { GroupedTransactionList } from "@/components/transaction/TransactionList";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Feedback";
import { ChipRow, Segmented } from "@/components/ui/Segmented";
import { MonthPicker } from "@/components/ui/MonthPicker";
import { useToast } from "@/components/ui/Toast";

type TypeFilter = "all" | TxType;

export default function RiwayatPage() {
  return (
    <Suspense fallback={<HistorySkeleton />}>
      <HistoryView />
    </Suspense>
  );
}

function HistoryView() {
  const params = useSearchParams();
  const { state, hydrated } = useStore();
  const toast = useToast();

  const [query, setQuery] = useState(() => params.get("q") ?? "");
  const [key, setKey] = useCurrentMonth();
  const [allMonths, setAllMonths] = useState(false);
  const [type, setType] = useState<TypeFilter>("all");
  const [category, setCategory] = useState<string>("all");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return state.transactions
      .filter((t) => (allMonths ? true : t.date.slice(0, 7) === key))
      .filter((t) => (type === "all" ? true : t.type === type))
      .filter((t) => (category === "all" ? true : t.categoryId === category))
      .filter((t) =>
        q
          ? t.note.toLowerCase().includes(q) ||
            getCategory(t.categoryId).label.toLowerCase().includes(q)
          : true,
      )
      .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt);
  }, [state.transactions, allMonths, key, type, category, query]);

  const totals = useMemo(() => {
    const income = filtered.reduce((s, t) => (t.type === "in" ? s + t.amount : s), 0);
    const expense = filtered.reduce((s, t) => (t.type === "out" ? s + t.amount : s), 0);
    return { income, expense, net: income - expense };
  }, [filtered]);

  // Only offer categories that actually appear in the current month scope.
  const categoryOptions = useMemo(() => {
    const scope = state.transactions.filter((t) => (allMonths ? true : t.date.slice(0, 7) === key));
    const present = new Set(scope.map((t) => t.categoryId));
    return [
      { value: "all", label: "Semua kategori" },
      ...CATEGORIES.filter((c) => present.has(c.id)).map((c) => ({ value: c.id, label: c.label })),
    ];
  }, [state.transactions, allMonths, key]);

  if (!hydrated) return <HistorySkeleton />;

  const { privacy } = state.settings;
  const hasFilters = type !== "all" || category !== "all" || query.trim() !== "" || allMonths;

  function resetFilters() {
    setType("all");
    setCategory("all");
    setQuery("");
    setAllMonths(false);
  }

  function exportCsv() {
    if (!filtered.length) {
      toast.error("Tidak ada transaksi untuk diekspor.");
      return;
    }
    const count = exportTransactionsCsv(filtered);
    toast.success(`${count} transaksi diekspor ke CSV`);
  }

  return (
    <div className="space-y-4 lg:space-y-5">
      <PageIntro title="Riwayat" description="Cari, filter, dan ekspor transaksi" />

      {/* --- Filter bar --- */}
      <Card className="dp-rise">
        <CardBody className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-ink-faint" />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Cari catatan atau kategori…"
                aria-label="Cari transaksi"
                className="h-11 w-full rounded-xl border border-line bg-surface-2 pl-10 pr-3 text-sm text-ink placeholder:text-ink-faint transition-colors duration-200 hover:border-line-strong focus:border-brand focus:bg-surface focus:outline-none"
              />
            </div>
            <Button variant="secondary" onClick={exportCsv} className="shrink-0">
              <Download className="size-4" />
              <span className="hidden sm:inline">Ekspor CSV</span>
            </Button>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <MonthPicker
              value={key}
              onChange={(k) => {
                setKey(k);
                setAllMonths(false);
              }}
              compact
              className={allMonths ? "opacity-50" : undefined}
            />
            <button
              type="button"
              onClick={() => setAllMonths((v) => !v)}
              aria-pressed={allMonths}
              className={`h-9 shrink-0 cursor-pointer rounded-xl border px-3 text-xs font-semibold transition-colors duration-200 ${
                allMonths
                  ? "border-brand bg-brand text-on-brand"
                  : "border-line bg-surface text-ink-muted hover:border-line-strong hover:text-ink"
              }`}
            >
              Semua bulan
            </button>

            <div className="w-full min-w-[220px] flex-1 sm:max-w-[300px]">
              <Segmented
                name="Tipe transaksi"
                size="sm"
                value={type}
                onChange={setType}
                options={[
                  { value: "all", label: "Semua" },
                  { value: "in", label: "Masuk", colorVar: "--success" },
                  { value: "out", label: "Keluar", colorVar: "--danger" },
                ]}
              />
            </div>

            {hasFilters ? (
              <Button variant="ghost" size="sm" onClick={resetFilters} className="shrink-0">
                <X className="size-3.5" />
                Reset
              </Button>
            ) : null}
          </div>

          <ChipRow value={category} onChange={setCategory} options={categoryOptions} />
        </CardBody>
      </Card>

      {/* --- Ringkasan hasil filter --- */}
      <div className="grid grid-cols-3 gap-3">
        <SummaryChip
          label="Masuk"
          value={privacy ? "••••" : formatCompact(totals.income)}
          colorVar="--success"
        />
        <SummaryChip
          label="Keluar"
          value={privacy ? "••••" : formatCompact(totals.expense)}
          colorVar="--danger"
        />
        <SummaryChip
          label="Selisih"
          value={privacy ? "••••" : formatCompact(totals.net)}
          colorVar={totals.net >= 0 ? "--success" : "--danger"}
        />
      </div>

      {/* --- Daftar --- */}
      <Card className="dp-rise">
        <CardHeader
          title={`${filtered.length} transaksi`}
          subtitle={allMonths ? "Semua bulan" : monthLabel(key)}
          action={<Filter className="size-4 text-ink-faint" />}
        />
        <CardBody className="pt-2">
          <GroupedTransactionList transactions={filtered} privacy={privacy} />
        </CardBody>
      </Card>
    </div>
  );
}

function SummaryChip({
  label,
  value,
  colorVar,
}: {
  label: string;
  value: string;
  colorVar: string;
}) {
  return (
    <div className="rounded-xl border border-line bg-surface px-3 py-2.5 text-center">
      <p className="text-[10px] font-bold uppercase tracking-wider text-ink-muted">{label}</p>
      <p
        className="mt-0.5 truncate text-sm font-extrabold tabular-nums"
        style={{ color: `var(${colorVar})` }}
      >
        {value}
      </p>
    </div>
  );
}

function HistorySkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-8 w-40" />
      <Skeleton className="h-40 rounded-card" />
      <div className="grid grid-cols-3 gap-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-16 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-96 rounded-card" />
    </div>
  );
}
