"use client";

import { Activity, TrendingUp } from "lucide-react";
import { useMemo } from "react";
import { monthKey, monthLabel, recentMonthKeys, shiftMonth } from "@/lib/format";
import { useCurrentMonth } from "@/lib/hooks";
import {
  budgetSummary,
  dailyBurn,
  deltaVsPrevious,
  liquidBalance,
  monthlyTrend,
  monthTotals,
  totalSaved,
} from "@/lib/stats";
import { useStore } from "@/lib/store";
import { BurnChart, CashflowChart, NetBarChart } from "@/components/charts/LazyCharts";
import { BalanceHero } from "@/components/home/BalanceHero";
import { BudgetOverviewCard } from "@/components/home/BudgetOverviewCard";
import { GoalsPreviewCard } from "@/components/home/GoalsPreviewCard";
import { RecentActivityCard } from "@/components/home/RecentActivityCard";
import { StatTiles } from "@/components/home/StatTiles";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { CardSkeleton, Skeleton } from "@/components/ui/Feedback";
import { MonthPicker } from "@/components/ui/MonthPicker";

export default function BerandaPage() {
  const { state, hydrated } = useStore();
  const [key, setKey] = useCurrentMonth();

  const data = useMemo(() => {
    const summary = budgetSummary(state.transactions, state.budgets, key);
    const totals = monthTotals(state.transactions, key);
    const trend = monthlyTrend(state.transactions, recentMonthKeys(6, new Date(`${key}-01T00:00:00`)));
    const burn = dailyBurn(state.transactions, key);
    const expenseDelta = deltaVsPrevious(state.transactions, key, shiftMonth(key, -1), "out");

    const now = new Date();
    const isCurrent = key === monthKey(now);
    const [y, m] = key.split("-").map(Number);
    const daysInMonth = new Date(y, m, 0).getDate();
    const daysLeft = isCurrent ? Math.max(0, daysInMonth - now.getDate()) : 0;

    return {
      summary,
      totals,
      trend,
      burn,
      expenseDelta,
      daysLeft,
      balance: liquidBalance(state),
      saved: totalSaved(state.goals),
      savingMonths: trend.filter((t) => t.net > 0).length,
    };
  }, [state, key]);

  if (!hydrated) return <HomeSkeleton />;

  const { privacy } = state.settings;

  return (
    <div className="space-y-4 lg:space-y-5">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-semibold text-ink-muted">
          Ringkasan <span className="text-ink">{monthLabel(key)}</span>
        </p>
        <MonthPicker value={key} onChange={setKey} compact />
      </div>

      {/* --- Saldo + metrik + ring --- */}
      <div className="grid grid-cols-12 gap-4 lg:gap-5">
        <div className="col-span-12 space-y-4 lg:space-y-5 xl:col-span-8">
          <BalanceHero
            balance={data.balance}
            saved={data.saved}
            totals={data.totals}
            monthKey={key}
            privacy={privacy}
          />
          <StatTiles
            summary={data.summary}
            expenseDelta={data.expenseDelta}
            daysLeft={data.daysLeft}
            privacy={privacy}
          />

          <Card>
            <CardHeader
              title="Laju Pengeluaran"
              subtitle={`Kumulatif ${monthLabel(key, true)} vs laju ideal`}
              action={
                <span
                  className="inline-flex items-center gap-1.5 rounded-pill px-2.5 py-1 text-[11px] font-bold"
                  style={{
                    color: data.summary.pct > 100 ? "var(--danger)" : "var(--success)",
                    background: data.summary.pct > 100 ? "var(--danger-soft)" : "var(--success-soft)",
                  }}
                >
                  <TrendingUp className="size-3" />
                  {Math.round(data.summary.pct)}%
                </span>
              }
            />
            <CardBody className="pt-2">
              <BurnChart data={data.burn} limit={data.summary.limit} privacy={privacy} />
              <p className="mt-3 flex items-start gap-2 text-[11px] leading-relaxed text-ink-muted">
                <Activity className="mt-0.5 size-3.5 shrink-0 text-ink-faint" />
                Garis putus-putus adalah laju ideal. Kalau garis solid ada di atasnya, kamu belanja
                lebih cepat dari plafon bulan ini.
              </p>
            </CardBody>
          </Card>
        </div>

        <div className="col-span-12 xl:col-span-4">
          <BudgetOverviewCard summary={data.summary} monthKey={key} privacy={privacy} />
        </div>
      </div>

      {/* --- Tren --- */}
      <div className="grid grid-cols-12 gap-4 lg:gap-5">
        <Card className="col-span-12 xl:col-span-7">
          <CardHeader
            title="Arus Kas 6 Bulan"
            subtitle="Pemasukan vs pengeluaran"
            action={
              <span className="hidden items-center gap-3 text-[11px] font-semibold text-ink-muted sm:flex">
                <span className="flex items-center gap-1.5">
                  <span className="size-2 rounded-full" style={{ background: "var(--success)" }} />
                  Masuk
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="size-2 rounded-full" style={{ background: "var(--brand)" }} />
                  Keluar
                </span>
              </span>
            }
          />
          <CardBody className="pt-2">
            <CashflowChart data={data.trend} privacy={privacy} />
          </CardBody>
        </Card>

        <Card className="col-span-12 xl:col-span-5">
          <CardHeader
            title="Sisa per Bulan"
            subtitle="Pemasukan dikurangi pengeluaran"
            action={
              <span className="text-[11px] font-semibold text-ink-muted">
                {data.savingMonths} dari {data.trend.length} bulan surplus
              </span>
            }
          />
          <CardBody className="pt-2">
            <NetBarChart data={data.trend} privacy={privacy} height={240} />
          </CardBody>
        </Card>
      </div>

      {/* --- Aktivitas & target --- */}
      <div className="grid grid-cols-12 gap-4 lg:gap-5">
        <div className="col-span-12 xl:col-span-7">
          <RecentActivityCard transactions={state.transactions} privacy={privacy} />
        </div>
        <div className="col-span-12 xl:col-span-5">
          <GoalsPreviewCard goals={state.goals} privacy={privacy} />
        </div>
      </div>
    </div>
  );
}

function HomeSkeleton() {
  return (
    <div className="space-y-4 lg:space-y-5">
      <Skeleton className="h-6 w-40" />
      <div className="grid grid-cols-12 gap-4 lg:gap-5">
        <div className="col-span-12 space-y-4 xl:col-span-8">
          <Skeleton className="h-52 rounded-card" />
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-32 rounded-card" />
            ))}
          </div>
        </div>
        <div className="col-span-12 xl:col-span-4">
          <Skeleton className="h-[460px] rounded-card" />
        </div>
      </div>
      <div className="grid grid-cols-12 gap-4 lg:gap-5">
        <CardSkeleton className="col-span-12 xl:col-span-7" lines={6} />
        <CardSkeleton className="col-span-12 xl:col-span-5" lines={6} />
      </div>
    </div>
  );
}
