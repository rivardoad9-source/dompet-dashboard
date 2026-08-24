"use client";

import { Eye, EyeOff, Moon, Plus, Search, Sun } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { cn } from "@/lib/cn";
import { pageTitle } from "@/lib/nav";
import { actions, useStore } from "@/lib/store";
import { Button, IconButton } from "@/components/ui/Button";
import { useTransactionSheet } from "@/components/transaction/TransactionSheetProvider";
import { Logo } from "./Logo";

/**
 * Time-of-day greeting. Pages are statically prerendered, so the server has no
 * idea what o'clock it is for the visitor — we render a neutral "Halo" until
 * the store hydrates, then swap in the real greeting.
 */
function greeting(hydrated: boolean): string {
  if (!hydrated) return "Halo";
  const h = new Date().getHours();
  if (h < 11) return "Selamat pagi";
  if (h < 15) return "Selamat siang";
  if (h < 19) return "Selamat sore";
  return "Selamat malam";
}

export function ThemeToggle({ className }: { className?: string }) {
  const { state } = useStore();
  const midnight = state.settings.theme === "midnight";
  return (
    <IconButton
      label={midnight ? "Ganti ke tema terang" : "Ganti ke tema gelap"}
      className={className}
      onClick={() => actions.setSettings({ theme: midnight ? "warm" : "midnight" })}
    >
      {midnight ? <Sun className="size-[18px]" /> : <Moon className="size-[18px]" />}
    </IconButton>
  );
}

export function PrivacyToggle({ className }: { className?: string }) {
  const { state } = useStore();
  const on = state.settings.privacy;
  return (
    <IconButton
      label={on ? "Tampilkan nominal" : "Sembunyikan nominal"}
      className={className}
      onClick={() => actions.setSettings({ privacy: !on })}
    >
      {on ? <EyeOff className="size-[18px]" /> : <Eye className="size-[18px]" />}
    </IconButton>
  );
}

function SearchBox() {
  const router = useRouter();
  const [q, setQ] = useState("");

  return (
    <form
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        router.push(q.trim() ? `/riwayat?q=${encodeURIComponent(q.trim())}` : "/riwayat");
      }}
      className="relative hidden xl:block"
    >
      <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-ink-faint" />
      <input
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Cari transaksi…"
        aria-label="Cari transaksi"
        className="h-10 w-64 rounded-xl border border-line bg-surface-2 pl-10 pr-3 text-sm text-ink placeholder:text-ink-faint transition-colors duration-200 hover:border-line-strong focus:border-brand focus:bg-surface focus:outline-none"
      />
    </form>
  );
}

function Avatar({ name }: { name: string }) {
  const initials = name.trim().slice(0, 2).toUpperCase() || "DP";
  return (
    <Link
      href="/pengaturan"
      className="flex items-center gap-2.5 rounded-xl p-1 pr-2 transition-colors duration-200 hover:bg-surface-2"
      aria-label="Buka pengaturan"
    >
      <span className="grid size-9 place-items-center rounded-xl bg-brand-soft text-xs font-extrabold text-brand">
        {initials}
      </span>
      <span className="hidden text-left leading-tight 2xl:block">
        <span className="block text-xs font-bold text-ink">{name}</span>
        <span className="block text-[10px] text-ink-faint">Akun lokal</span>
      </span>
    </Link>
  );
}

export function Topbar() {
  const pathname = usePathname();
  const { state, hydrated } = useStore();
  const sheet = useTransactionSheet();
  const title = pageTitle(pathname);
  const onHome = pathname === "/";

  return (
    <header
      className={cn(
        "dp-safe-top sticky top-0 z-20 border-b border-line",
        "bg-bg/85 backdrop-blur-xl supports-[backdrop-filter]:bg-bg/70",
      )}
    >
      {/* ---- Mobile ---- */}
      <div className="mx-auto flex h-16 max-w-app items-center gap-2 px-4 lg:hidden">
        {onHome ? (
          <div className="min-w-0 flex-1">
            <p className="truncate text-[11px] font-semibold text-ink-muted">{greeting(hydrated)},</p>
            <p className="truncate text-lg font-extrabold leading-tight tracking-tight text-ink">
              {state.settings.name} 👋
            </p>
          </div>
        ) : (
          <div className="min-w-0 flex-1">
            <Logo />
          </div>
        )}
        <PrivacyToggle />
        <ThemeToggle />
      </div>

      {/* ---- Desktop ---- */}
      <div className="mx-auto hidden h-[72px] max-w-shell items-center gap-3 px-8 lg:flex">
        <div className="min-w-0">
          <h1 className="truncate text-xl font-extrabold tracking-tight text-ink">{title}</h1>
          <p className="truncate text-xs text-ink-muted">
            {onHome ? `${greeting(hydrated)}, ${state.settings.name}` : "Kelola keuangan pribadimu"}
          </p>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <SearchBox />
          <PrivacyToggle />
          <ThemeToggle />
          <Button onClick={() => sheet.open()} className="ml-1">
            <Plus className="size-4" />
            Catat Transaksi
          </Button>
          <span aria-hidden className="mx-1 h-8 w-px bg-line" />
          <Avatar name={state.settings.name} />
        </div>
      </div>
    </header>
  );
}
