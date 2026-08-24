"use client";

import { Sparkles, TrendingUp } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";
import { formatCompact } from "@/lib/format";
import { isActivePath, NAV_ITEMS } from "@/lib/nav";
import { budgetSummary, liquidBalance } from "@/lib/stats";
import { monthKey } from "@/lib/format";
import { useStore } from "@/lib/store";
import { Logo } from "./Logo";

/** Desktop-only admin rail. Below `lg` the bottom bar takes over. */
export function Sidebar() {
  const pathname = usePathname();
  const { state, hydrated } = useStore();
  const key = monthKey(new Date());
  const summary = budgetSummary(state.transactions, state.budgets, key);
  const balance = liquidBalance(state);

  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-[264px] flex-col border-r border-line bg-surface lg:flex">
      <div className="px-6 py-6">
        <Logo />
      </div>

      <nav className="dp-no-scrollbar min-h-0 flex-1 space-y-1 overflow-y-auto px-4" aria-label="Navigasi utama">
        {NAV_ITEMS.map((item) => {
          const active = isActivePath(pathname, item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "group relative flex items-center gap-3 rounded-xl px-3.5 py-3 text-sm font-semibold",
                "transition-all duration-200 ease-out",
                active
                  ? "bg-brand text-on-brand shadow-soft"
                  : "text-ink-muted hover:bg-surface-2 hover:text-ink",
              )}
            >
              <Icon className={cn("size-[18px] shrink-0 transition-transform duration-200", !active && "group-hover:scale-110")} />
              {item.label}
              {active ? (
                <span aria-hidden className="ml-auto size-1.5 rounded-full bg-on-brand/70" />
              ) : null}
            </Link>
          );
        })}
      </nav>

      {/* Live budget pulse — keeps the number in view no matter which tab is open */}
      <div className="px-4 pb-4">
        <div className="dp-hero relative overflow-hidden rounded-card p-4 text-hero-ink">
          <div
            aria-hidden
            className="absolute -right-8 -top-8 size-28 rounded-full bg-hero-ink/10 blur-xl"
          />
          <div className="relative">
            <div className="flex items-center gap-1.5">
              <Sparkles className="size-3.5" />
              <p className="text-[11px] font-bold uppercase tracking-wider">Saldo likuid</p>
            </div>
            <p className="mt-2 text-2xl font-extrabold tracking-tight">
              {hydrated
                ? state.settings.privacy
                  ? "••••••"
                  : formatCompact(balance)
                : "—"}
            </p>
            <div className="mt-3 flex items-center gap-1.5 text-[11px] font-medium text-hero-ink-muted">
              <TrendingUp className="size-3.5" />
              <span>
                {hydrated ? `${Math.round(summary.pct)}% anggaran terpakai` : "Memuat…"}
              </span>
            </div>
          </div>
        </div>
      </div>

      <p className="border-t border-line px-6 py-4 text-[11px] text-ink-faint">
        Dompet v1.1 · Data tersimpan lokal
      </p>
    </aside>
  );
}
