"use client";

import { CalendarClock, Check, History, Pencil, Plus } from "lucide-react";
import { formatCompact, formatDate, formatIDR } from "@/lib/format";
import { goalProgress } from "@/lib/stats";
import type { Goal } from "@/lib/types";
import { Button, IconButton } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Money } from "@/components/ui/Money";
import { ProgressBar } from "@/components/ui/Progress";

/**
 * One savings target: progress, the calculator's monthly recommendation
 * (PRD §3C), and the two actions that matter — setor and riwayat.
 */
export function GoalCard({
  goal,
  privacy,
  onDeposit,
  onEdit,
  onHistory,
}: {
  goal: Goal;
  privacy: boolean;
  onDeposit: () => void;
  onEdit: () => void;
  onHistory: () => void;
}) {
  const p = goalProgress(goal);

  return (
    <Card className="dp-rise flex h-full flex-col p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <span
            className="size-3 shrink-0 rounded-full"
            style={{ background: `var(${goal.colorVar})` }}
          />
          <h3 className="truncate text-[15px] font-bold tracking-tight text-ink">{goal.name}</h3>
        </div>
        <div className="-mr-2 -mt-2 flex shrink-0">
          <IconButton label={`Riwayat ${goal.name}`} onClick={onHistory}>
            <History className="size-[17px]" />
          </IconButton>
          <IconButton label={`Edit ${goal.name}`} onClick={onEdit}>
            <Pencil className="size-[17px]" />
          </IconButton>
        </div>
      </div>

      <div className="mt-4 flex items-end justify-between gap-3">
        <Money
          value={p.saved}
          privacy={privacy}
          className="text-2xl font-extrabold tracking-tighter text-ink"
        />
        <span className="pb-0.5 text-xs font-semibold text-ink-muted">
          / {privacy ? "••••" : formatCompact(goal.target)}
        </span>
      </div>

      <ProgressBar
        value={p.pct}
        colorVar={goal.colorVar}
        height={10}
        className="mt-3"
        label={`Progres ${goal.name}`}
      />

      <div className="mt-2 flex items-center justify-between gap-2 text-[11px]">
        <span className="font-bold tabular-nums" style={{ color: `var(${goal.colorVar})` }}>
          {Math.round(p.pct)}% tercapai
        </span>
        <span className="truncate text-ink-faint">
          {p.done ? "Target tercapai" : `Kurang ${privacy ? "••••" : formatCompact(p.remaining)}`}
        </span>
      </div>

      {/* Kalkulator rekomendasi */}
      <div className="mt-4 flex-1 rounded-xl bg-surface-2 p-3">
        {p.done ? (
          <p
            className="flex items-center gap-2 text-xs font-bold"
            style={{ color: "var(--success)" }}
          >
            <Check className="size-4" />
            Selamat, target ini sudah lunas!
          </p>
        ) : (
          <>
            <p className="text-[10px] font-bold uppercase tracking-wider text-ink-muted">
              Rekomendasi setoran
            </p>
            <p className="mt-0.5 text-sm font-extrabold tabular-nums text-ink">
              {privacy ? "••••••" : formatIDR(p.suggested)}
              <span className="text-xs font-medium text-ink-faint"> / bulan</span>
            </p>
            <p className="mt-1.5 flex items-center gap-1.5 text-[11px] text-ink-faint">
              <CalendarClock className="size-3.5 shrink-0" />
              {goal.deadline
                ? `${p.monthsLeft} bulan lagi · target ${formatDate(goal.deadline)}`
                : "Belum ada tenggat"}
            </p>
          </>
        )}
      </div>

      <Button className="mt-4 w-full" onClick={onDeposit}>
        <Plus className="size-4" />
        Setor Dana
      </Button>
    </Card>
  );
}
