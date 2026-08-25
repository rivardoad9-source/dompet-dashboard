"use client";

import { AlertTriangle, Pencil, PieChart, Plus, SlidersHorizontal } from "lucide-react";
import { useMemo, useState } from "react";
import { getCategory } from "@/lib/categories";
import { formatCompact, formatIDR, monthLabel, STATUS_META } from "@/lib/format";
import { useCurrentMonth } from "@/lib/hooks";
import { budgetSummary, categoryBreakdown, unbudgetedCategories } from "@/lib/stats";
import { useStore } from "@/lib/store";
import { PageIntro } from "@/components/shell/AppShell";
import { BudgetRing } from "@/components/charts/BudgetRing";
import { BudgetEditorSheet } from "@/components/budget/BudgetEditorSheet";
import { StatusBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { CardSkeleton, EmptyState, Skeleton } from "@/components/ui/Feedback";
import { MonthPicker } from "@/components/ui/MonthPicker";
import { Money } from "@/components/ui/Money";
import { OverflowBar, ProgressBar } from "@/components/ui/Progress";
import { Sheet } from "@/components/ui/Sheet";

export default function AnggaranPage() {
  const { state, hydrated } = useStore();
  const [key, setKey] = useCurrentMonth();
  const [editing, setEditing] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);

  const summary = useMemo(
    () => budgetSummary(state.transactions, state.budgets, key),
    [state.transactions, state.budgets, key],
  );
  const breakdown = useMemo(
    () => categoryBreakdown(state.transactions, key),
    [state.transactions, key],
  );
  const available = useMemo(() => unbudgetedCategories(state.budgets), [state.budgets]);

  if (!hydrated) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 rounded-card" />
        <CardSkeleton lines={8} />
      </div>
    );
  }

  const { privacy } = state.settings;
  const editingRow = summary.rows.find((r) => r.categoryId === editing);
  const alerts = summary.rows.filter((r) => r.status !== "safe");

  return (
    <div className="space-y-4 lg:space-y-5">
      <PageIntro title="Anggaran" description="Plafon dan realisasi per kategori" />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <MonthPicker value={key} onChange={setKey} compact />
        <Button
          variant={available.length ? "primary" : "secondary"}
          size="sm"
          disabled={!available.length}
          onClick={() => setPicking(true)}
        >
          <Plus className="size-4" />
          Tambah kategori
        </Button>
      </div>

      <div className="grid grid-cols-12 gap-4 lg:gap-5">
        {/* --- Total --- */}
        <Card className="dp-rise col-span-12 xl:col-span-5">
          <CardHeader title="Total Anggaran" subtitle={monthLabel(key)} action={<StatusBadge status={summary.status} />} />
          <CardBody className="pt-2">
            <div className="flex items-end justify-between gap-3">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-ink-muted">
                  Realisasi
                </p>
                <Money
                  value={summary.spent}
                  privacy={privacy}
                  className="mt-0.5 block text-3xl font-extrabold tracking-tighter text-ink"
                />
              </div>
              <p className="pb-1 text-sm font-semibold text-ink-muted">
                / {privacy ? "••••" : formatCompact(summary.limit)}
              </p>
            </div>

            <OverflowBar
              value={summary.pct}
              colorVar={STATUS_META[summary.status].colorVar}
              height={12}
              className="mt-4"
            />

            <dl className="mt-5 grid grid-cols-2 gap-3">
              <Metric
                label={summary.remaining >= 0 ? "Sisa aman" : "Kelebihan"}
                value={formatIDR(Math.abs(summary.remaining))}
                privacy={privacy}
                colorVar={summary.remaining >= 0 ? "--success" : "--danger"}
              />
              <Metric
                label="Di luar plafon"
                value={formatIDR(Math.max(0, summary.spentAll - summary.spent))}
                privacy={privacy}
                colorVar="--ink-muted"
              />
            </dl>

            {alerts.length ? (
              <div
                className="mt-5 rounded-xl p-3"
                style={{ background: "var(--warning-soft)" }}
                role="status"
              >
                <p
                  className="flex items-center gap-2 text-xs font-bold"
                  style={{ color: "var(--warning)" }}
                >
                  <AlertTriangle className="size-4" />
                  {alerts.length} kategori perlu perhatian
                </p>
                <ul className="mt-2 space-y-1 pl-6 text-[11px]" style={{ color: "var(--warning)" }}>
                  {alerts.slice(0, 3).map((r) => (
                    <li key={r.categoryId} className="list-disc">
                      {r.label} — {Math.round(r.pct)}% terpakai
                    </li>
                  ))}
                  {alerts.length > 3 ? (
                    <li className="list-disc opacity-80">
                      dan {alerts.length - 3} kategori lainnya
                    </li>
                  ) : null}
                </ul>
              </div>
            ) : null}

            {summary.limit > 0 ? (
              <div className="mt-6 border-t border-line pt-5">
                <p className="mb-1 text-center text-[11px] font-bold uppercase tracking-wider text-ink-muted">
                  Sebaran realisasi
                </p>
                <BudgetRing summary={summary} privacy={privacy} size={210} thickness={18} />
              </div>
            ) : null}
          </CardBody>
        </Card>

        {/* --- Rincian per kategori --- */}
        <Card className="dp-rise col-span-12 xl:col-span-7">
          <CardHeader
            title="Alokasi per Kategori"
            subtitle="Ketuk baris mana pun untuk mengubah plafonnya"
            action={<SlidersHorizontal className="size-4 text-ink-faint" />}
          />
          <CardBody className="pt-2">
            {summary.rows.length ? (
              <ul className="-mx-2 space-y-1">
                {summary.rows.map((row) => {
                  const cat = getCategory(row.categoryId);
                  const Icon = cat.icon;
                  const meta = STATUS_META[row.status];
                  return (
                    <li key={row.categoryId}>
                      <button
                        type="button"
                        onClick={() => setEditing(row.categoryId)}
                        className="group w-full cursor-pointer rounded-xl px-2 py-3 text-left transition-colors duration-200 hover:bg-surface-2"
                      >
                        <div className="flex items-center gap-3">
                          <span
                            className="grid size-9 shrink-0 place-items-center rounded-xl transition-transform duration-200 group-hover:scale-105"
                            style={{
                              background: `color-mix(in oklab, var(${cat.colorVar}) 15%, var(--surface))`,
                              color: `var(${cat.colorVar})`,
                            }}
                          >
                            <Icon className="size-[18px]" />
                          </span>

                          <span className="min-w-0 flex-1">
                            <span className="flex items-baseline justify-between gap-2">
                              <span className="truncate text-sm font-semibold text-ink">
                                {row.label}
                              </span>
                              <span className="shrink-0 text-xs font-bold tabular-nums text-ink">
                                {privacy ? "••••" : formatCompact(row.spent)}
                                <span className="font-medium text-ink-faint">
                                  {" / "}
                                  {privacy ? "••••" : formatCompact(row.limit)}
                                </span>
                              </span>
                            </span>

                            <OverflowBar
                              value={row.pct}
                              colorVar={row.status === "safe" ? cat.colorVar : meta.colorVar}
                              className="mt-2"
                            />

                            <span className="mt-1.5 flex items-center justify-between gap-2 text-[11px]">
                              <span className="text-ink-faint">
                                {row.txCount} transaksi
                                {row.remaining >= 0
                                  ? ` · sisa ${privacy ? "••••" : formatCompact(row.remaining)}`
                                  : ` · lewat ${privacy ? "••••" : formatCompact(-row.remaining)}`}
                              </span>
                              <span
                                className="font-bold tabular-nums"
                                style={{ color: `var(${meta.colorVar})` }}
                              >
                                {Math.round(row.pct)}%
                              </span>
                            </span>
                          </span>

                          {/* Tanda bahwa barisnya bisa diketuk. Tanpa ini
                              barisnya terlihat seperti bacaan biasa, dan
                              pengaturan plafon jadi tidak pernah ditemukan. */}
                          <span
                            aria-hidden
                            className="grid size-7 shrink-0 place-items-center rounded-lg bg-surface-2 text-ink-faint transition-all duration-200 group-hover:bg-brand-soft group-hover:text-brand"
                          >
                            <Pencil className="size-3.5" />
                          </span>
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <EmptyState
                icon={PieChart}
                title="Belum ada kategori dianggarkan"
                description="Tambahkan minimal satu kategori supaya ring di Beranda punya acuan."
                action={
                  <Button onClick={() => setPicking(true)}>
                    <Plus className="size-4" />
                    Tambah kategori
                  </Button>
                }
              />
            )}
          </CardBody>
        </Card>
      </div>

      {/* --- Komposisi pengeluaran --- */}
      <Card className="dp-rise">
        <CardHeader
          title="Komposisi Pengeluaran"
          subtitle={`Semua pengeluaran ${monthLabel(key)}, termasuk kategori tanpa plafon`}
        />
        <CardBody className="pt-2">
          {breakdown.length ? (
            <ul className="space-y-3">
              {breakdown.map((slice) => (
                <li key={slice.categoryId} className="flex items-center gap-3">
                  <span
                    className="size-2.5 shrink-0 rounded-full"
                    style={{ background: `var(${slice.colorVar})` }}
                  />
                  {/* Label and figures share one line; the bar sits under them,
                      so the row never forces horizontal scroll on a 320px phone. */}
                  <span className="min-w-0 flex-1 sm:flex sm:items-center sm:gap-3">
                    <span className="flex items-baseline justify-between gap-2 sm:w-44 sm:shrink-0">
                      <span className="truncate text-xs font-semibold text-ink">{slice.label}</span>
                      <span className="shrink-0 text-xs font-bold tabular-nums text-ink sm:hidden">
                        {privacy ? "••••" : formatCompact(slice.amount)}
                      </span>
                    </span>

                    <ProgressBar
                      value={slice.share}
                      colorVar={slice.colorVar}
                      className="mt-1.5 sm:mt-0 sm:flex-1"
                      height={7}
                      label={`${slice.label} ${Math.round(slice.share)} persen`}
                    />

                    <span className="hidden w-24 shrink-0 text-right text-xs font-bold tabular-nums text-ink sm:block">
                      {privacy ? "••••" : formatCompact(slice.amount)}
                    </span>
                  </span>

                  <span className="w-9 shrink-0 text-right text-[11px] font-bold tabular-nums text-ink-faint">
                    {Math.round(slice.share)}%
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState
              icon={PieChart}
              title="Belum ada pengeluaran"
              description={`Tidak ada transaksi keluar pada ${monthLabel(key)}.`}
            />
          )}
        </CardBody>
      </Card>

      {/* --- Sheets --- */}
      {editing ? (
        <BudgetEditorSheet
          categoryId={editing}
          currentLimit={editingRow?.limit ?? 0}
          spent={editingRow?.spent ?? 0}
          onClose={() => setEditing(null)}
        />
      ) : null}

      {picking ? (
        <CategoryPickerSheet
          categories={available}
          onClose={() => setPicking(false)}
          onPick={(id) => {
            setPicking(false);
            setEditing(id);
          }}
        />
      ) : null}
    </div>
  );
}

function Metric({
  label,
  value,
  privacy,
  colorVar,
}: {
  label: string;
  value: string;
  privacy: boolean;
  colorVar: string;
}) {
  return (
    <div className="rounded-xl bg-surface-2 p-3">
      <dt className="text-[10px] font-bold uppercase tracking-wider text-ink-muted">{label}</dt>
      <dd className="mt-0.5 text-sm font-extrabold tabular-nums" style={{ color: `var(${colorVar})` }}>
        {privacy ? "••••••" : value}
      </dd>
    </div>
  );
}

function CategoryPickerSheet({
  categories,
  onClose,
  onPick,
}: {
  categories: ReturnType<typeof unbudgetedCategories>;
  onClose: () => void;
  onPick: (id: string) => void;
}) {
  return (
    <Sheet
      open
      onClose={onClose}
      title="Pilih kategori"
      description="Kategori yang belum punya plafon bulanan."
    >
      <div className="grid grid-cols-2 gap-2 pb-4 sm:grid-cols-3">
        {categories.map((cat) => {
          const Icon = cat.icon;
          return (
            <button
              key={cat.id}
              type="button"
              onClick={() => onPick(cat.id)}
              className="flex cursor-pointer flex-col items-start gap-2 rounded-xl border border-line bg-surface-2 p-3 text-left transition-all duration-200 hover:border-brand hover:bg-surface active:scale-95"
            >
              <Icon className="size-[18px]" style={{ color: `var(${cat.colorVar})` }} />
              <span className="text-xs font-semibold text-ink">{cat.label}</span>
            </button>
          );
        })}
      </div>
    </Sheet>
  );
}
