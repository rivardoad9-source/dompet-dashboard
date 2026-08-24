"use client";

import { ArrowRight, Target } from "lucide-react";
import Link from "next/link";
import { formatCompact } from "@/lib/format";
import { goalProgress } from "@/lib/stats";
import type { Goal } from "@/lib/types";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/Feedback";
import { ProgressBar } from "@/components/ui/Progress";

/** Condensed savings-goal list for the home screen. */
export function GoalsPreviewCard({ goals, privacy }: { goals: Goal[]; privacy: boolean }) {
  const rows = goals.slice(0, 3);

  return (
    <Card className="dp-rise flex h-full flex-col">
      <CardHeader
        title="Target Tabungan"
        subtitle={`${goals.length} target berjalan`}
        action={
          <Link
            href="/tabungan"
            className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-bold text-brand transition-colors duration-200 hover:bg-brand-soft"
          >
            Kelola
            <ArrowRight className="size-3.5" />
          </Link>
        }
      />

      <CardBody className="flex-1 pt-2">
        {rows.length ? (
          <ul className="space-y-4">
            {rows.map((goal) => {
              const p = goalProgress(goal);
              return (
                <li key={goal.id}>
                  <Link
                    href="/tabungan"
                    className="group block rounded-xl p-2 -m-2 transition-colors duration-200 hover:bg-surface-2"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="flex min-w-0 items-center gap-2">
                        <span
                          className="size-2.5 shrink-0 rounded-full"
                          style={{ background: `var(${goal.colorVar})` }}
                        />
                        <span className="truncate text-sm font-semibold text-ink">{goal.name}</span>
                      </span>
                      <span className="shrink-0 text-xs font-bold tabular-nums text-ink-muted">
                        {Math.round(p.pct)}%
                      </span>
                    </div>

                    <ProgressBar
                      value={p.pct}
                      colorVar={goal.colorVar}
                      className="mt-2"
                      label={`Progres ${goal.name}`}
                    />

                    <p className="mt-1.5 text-[11px] text-ink-faint">
                      {privacy ? "••••" : formatCompact(p.saved)} dari{" "}
                      {privacy ? "••••" : formatCompact(goal.target)}
                      {p.done ? " · tercapai 🎉" : p.monthsLeft ? ` · sisa ${p.monthsLeft} bln` : ""}
                    </p>
                  </Link>
                </li>
              );
            })}
          </ul>
        ) : (
          <EmptyState
            icon={Target}
            title="Belum ada target"
            description="Bikin target seperti Dana Darurat atau Liburan, lalu pantau progresnya di sini."
            action={
              <Link
                href="/tabungan"
                className="inline-flex h-11 items-center gap-2 rounded-xl bg-brand px-4 text-sm font-semibold text-on-brand transition-colors duration-200 hover:bg-brand-strong"
              >
                Buat target
              </Link>
            }
          />
        )}
      </CardBody>
    </Card>
  );
}
