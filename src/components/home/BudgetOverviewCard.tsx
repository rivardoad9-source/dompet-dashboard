"use client";

import { AlertTriangle, ArrowRight, PieChart } from "lucide-react";
import Link from "next/link";
import { monthLabel } from "@/lib/format";
import type { BudgetSummary } from "@/lib/stats";
import { BudgetRing, RingLegend } from "@/components/charts/BudgetRing";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/Feedback";

/** PRD §3A headline card: the ring, its legend, and any overspend warning. */
export function BudgetOverviewCard({
  summary,
  monthKey: key,
  privacy,
}: {
  summary: BudgetSummary;
  monthKey: string;
  privacy: boolean;
}) {
  const hasData = summary.limit > 0;

  return (
    <Card className="dp-rise flex h-full flex-col">
      <CardHeader
        title="Anggaran vs Realisasi"
        subtitle={monthLabel(key)}
        action={
          <Link
            href="/anggaran"
            className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-bold text-brand transition-colors duration-200 hover:bg-brand-soft"
          >
            Detail
            <ArrowRight className="size-3.5" />
          </Link>
        }
      />

      <CardBody className="flex flex-1 flex-col justify-center pt-2">
        {hasData ? (
          <>
            <BudgetRing summary={summary} privacy={privacy} />
            <RingLegend summary={summary} privacy={privacy} />

            {summary.overCount > 0 ? (
              <div
                className="mt-4 flex items-start gap-2.5 rounded-xl p-3"
                style={{ background: "var(--danger-soft)" }}
                role="status"
              >
                <AlertTriangle className="mt-0.5 size-4 shrink-0" style={{ color: "var(--danger)" }} />
                <p className="text-xs leading-relaxed" style={{ color: "var(--danger)" }}>
                  <strong className="font-bold">{summary.overCount} kategori</strong> sudah melewati
                  batas. Cek tab Anggaran untuk menyesuaikan.
                </p>
              </div>
            ) : null}
          </>
        ) : (
          <EmptyState
            icon={PieChart}
            title="Belum ada anggaran"
            description="Tentukan plafon per kategori supaya ring ini punya sesuatu untuk diukur."
            action={
              <Link
                href="/anggaran"
                className="inline-flex h-11 items-center gap-2 rounded-xl bg-brand px-4 text-sm font-semibold text-on-brand transition-colors duration-200 hover:bg-brand-strong"
              >
                Atur anggaran
              </Link>
            }
          />
        )}
      </CardBody>
    </Card>
  );
}
