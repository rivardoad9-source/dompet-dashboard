"use client";

import { Plus } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";
import { isActivePath, PRIMARY_NAV } from "@/lib/nav";
import { useTransactionSheet } from "@/components/transaction/TransactionSheetProvider";

/**
 * Four tabs plus a centred quick-add, exactly as specified in the PRD.
 * Hidden from `lg` up, where the sidebar takes over.
 */
export function BottomNav() {
  const pathname = usePathname();
  const sheet = useTransactionSheet();

  const [left, right] = [PRIMARY_NAV.slice(0, 2), PRIMARY_NAV.slice(2)];

  const renderTab = (href: string, label: string, Icon: (typeof PRIMARY_NAV)[number]["icon"]) => {
    const active = isActivePath(pathname, href);
    return (
      <Link
        key={href}
        href={href}
        aria-current={active ? "page" : undefined}
        className={cn(
          "flex min-h-[52px] flex-1 flex-col items-center justify-center gap-1 rounded-xl px-1 py-1.5",
          "transition-colors duration-200 ease-out active:scale-95",
          active ? "text-brand" : "text-ink-faint hover:text-ink-muted",
        )}
      >
        <span className="relative">
          <Icon className={cn("size-[21px] transition-transform duration-200", active && "scale-110")} />
          {active ? (
            <span
              aria-hidden
              className="absolute -bottom-1.5 left-1/2 size-1 -translate-x-1/2 rounded-full bg-brand"
            />
          ) : null}
        </span>
        <span className="text-[10px] font-bold leading-none">{label}</span>
      </Link>
    );
  };

  return (
    <nav
      aria-label="Navigasi utama"
      className="dp-panel dp-safe-bottom fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 backdrop-blur-xl lg:hidden"
    >
      <div className="mx-auto flex max-w-app items-center gap-1 px-2 py-1.5">
        {left.map((i) => renderTab(i.href, i.label, i.icon))}

        {/* Quick action (PRD §3A) — opens the transaction bottom sheet */}
        <div className="flex w-16 shrink-0 justify-center">
          <button
            type="button"
            onClick={() => sheet.open()}
            aria-label="Catat transaksi baru"
            className="-mt-7 grid size-14 cursor-pointer place-items-center rounded-2xl bg-brand text-on-brand shadow-float transition-transform duration-200 ease-out hover:scale-105 active:scale-95"
          >
            <Plus className="size-6" strokeWidth={2.6} />
          </button>
        </div>

        {right.map((i) => renderTab(i.href, i.label, i.icon))}
      </div>
    </nav>
  );
}
