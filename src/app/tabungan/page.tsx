"use client";

import { PiggyBank, Plus, Target, TrendingUp } from "lucide-react";
import { useMemo, useState } from "react";
import { formatCompact } from "@/lib/format";
import { goalProgress, totalSaved } from "@/lib/stats";
import { useStore } from "@/lib/store";
import type { Goal } from "@/lib/types";
import { PageIntro } from "@/components/shell/AppShell";
import { GoalCard } from "@/components/savings/GoalCard";
import { DepositSheet, GoalEditorSheet, GoalHistorySheet } from "@/components/savings/GoalSheets";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { EmptyState, Skeleton } from "@/components/ui/Feedback";
import { Money } from "@/components/ui/Money";
import { ProgressBar } from "@/components/ui/Progress";

type Mode =
  | { kind: "none" }
  | { kind: "create" }
  | { kind: "edit"; goal: Goal }
  | { kind: "deposit"; goal: Goal }
  | { kind: "history"; goal: Goal };

export default function TabunganPage() {
  const { state, hydrated } = useStore();
  const [mode, setMode] = useState<Mode>({ kind: "none" });

  const totals = useMemo(() => {
    const saved = totalSaved(state.goals);
    const target = state.goals.reduce((s, g) => s + g.target, 0);
    const monthly = state.goals.reduce((s, g) => {
      const p = goalProgress(g);
      return s + (p.done ? 0 : p.suggested);
    }, 0);
    const done = state.goals.filter((g) => goalProgress(g).done).length;
    return { saved, target, monthly, done, pct: target > 0 ? (saved / target) * 100 : 0 };
  }, [state.goals]);

  if (!hydrated) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-36 rounded-card" />
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-72 rounded-card" />
          ))}
        </div>
      </div>
    );
  }

  const { privacy } = state.settings;

  // Keep the live object so sheets react to edits made while they're open.
  const activeGoal =
    mode.kind === "edit" || mode.kind === "deposit" || mode.kind === "history"
      ? state.goals.find((g) => g.id === mode.goal.id)
      : undefined;

  return (
    <div className="space-y-4 lg:space-y-5">
      <PageIntro title="Tabungan" description="Target dana dan progresnya" />

      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-semibold text-ink-muted">
          {state.goals.length} target · {totals.done} tercapai
        </p>
        <Button size="sm" onClick={() => setMode({ kind: "create" })}>
          <Plus className="size-4" />
          Target baru
        </Button>
      </div>

      {/* --- Ringkasan --- */}
      <Card className="dp-rise">
        <CardHeader title="Total Tabungan" subtitle="Gabungan semua target" />
        <CardBody className="pt-2">
          <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr] lg:items-center">
            <div>
              <div className="flex items-end justify-between gap-3">
                <Money
                  value={totals.saved}
                  privacy={privacy}
                  className="text-3xl font-extrabold tracking-tighter text-ink"
                />
                <span className="pb-1 text-sm font-semibold text-ink-muted">
                  / {privacy ? "••••" : formatCompact(totals.target)}
                </span>
              </div>
              <ProgressBar
                value={totals.pct}
                colorVar="--brand"
                height={12}
                className="mt-3"
                label="Total progres tabungan"
              />
              <p className="mt-2 text-[11px] font-semibold text-ink-faint">
                {Math.round(totals.pct)}% dari total target terkumpul
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <SummaryTile
                icon={<TrendingUp className="size-4" />}
                label="Setoran / bulan"
                value={privacy ? "••••" : formatCompact(totals.monthly)}
                hint="Agar semua target tepat waktu"
                colorVar="--cat-3"
              />
              <SummaryTile
                icon={<Target className="size-4" />}
                label="Sisa dibutuhkan"
                value={privacy ? "••••" : formatCompact(Math.max(0, totals.target - totals.saved))}
                hint={`${state.goals.length - totals.done} target berjalan`}
                colorVar="--cat-5"
              />
            </div>
          </div>
        </CardBody>
      </Card>

      {/* --- Daftar target --- */}
      {state.goals.length ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {state.goals.map((goal) => (
            <GoalCard
              key={goal.id}
              goal={goal}
              privacy={privacy}
              onDeposit={() => setMode({ kind: "deposit", goal })}
              onEdit={() => setMode({ kind: "edit", goal })}
              onHistory={() => setMode({ kind: "history", goal })}
            />
          ))}
        </div>
      ) : (
        <Card>
          <EmptyState
            icon={PiggyBank}
            title="Belum punya target tabungan"
            description="Mulai dari Dana Darurat 3× pengeluaran bulanan — target paling berguna untuk pemula."
            action={
              <Button onClick={() => setMode({ kind: "create" })}>
                <Plus className="size-4" />
                Buat target pertama
              </Button>
            }
          />
        </Card>
      )}

      {/* --- Sheets --- */}
      {mode.kind === "create" ? (
        <GoalEditorSheet goal={null} onClose={() => setMode({ kind: "none" })} />
      ) : null}
      {mode.kind === "edit" && activeGoal ? (
        <GoalEditorSheet goal={activeGoal} onClose={() => setMode({ kind: "none" })} />
      ) : null}
      {mode.kind === "deposit" && activeGoal ? (
        <DepositSheet goal={activeGoal} onClose={() => setMode({ kind: "none" })} />
      ) : null}
      {mode.kind === "history" && activeGoal ? (
        <GoalHistorySheet goal={activeGoal} onClose={() => setMode({ kind: "none" })} />
      ) : null}
    </div>
  );
}

function SummaryTile({
  icon,
  label,
  value,
  hint,
  colorVar,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint: string;
  colorVar: string;
}) {
  return (
    <div className="rounded-xl bg-surface-2 p-3">
      <span
        className="grid size-8 place-items-center rounded-lg"
        style={{
          background: `color-mix(in oklab, var(${colorVar}) 16%, var(--surface))`,
          color: `var(${colorVar})`,
        }}
      >
        {icon}
      </span>
      <p className="mt-2.5 text-[10px] font-bold uppercase tracking-wider text-ink-muted">{label}</p>
      <p className="mt-0.5 truncate text-base font-extrabold tabular-nums text-ink">{value}</p>
      <p className="mt-0.5 truncate text-[10px] text-ink-faint">{hint}</p>
    </div>
  );
}
