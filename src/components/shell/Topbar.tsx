"use client";

import { Eye, EyeOff, Moon, Plus, Search, Settings, Sun } from "lucide-react";
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

function initialsOf(name: string) {
  return name.trim().slice(0, 2).toUpperCase() || "DP";
}

/**
 * Foto profil kalau ada, inisial kalau tidak.
 *
 * `<img>` biasa, bukan `next/image`: sumbernya data URL dari localStorage, jadi
 * tidak ada yang bisa dioptimalkan di sisi server dan pengoptimalnya justru
 * akan menolak skema `data:`.
 */
function AvatarFace({ name, avatar, className }: { name: string; avatar: string; className?: string }) {
  if (avatar) {
    return (
      /* eslint-disable-next-line @next/next/no-img-element -- data URL lokal, bukan aset yang bisa dioptimalkan */
      <img
        src={avatar}
        alt=""
        className={cn("shrink-0 rounded-xl object-cover", className)}
      />
    );
  }
  return (
    <span
      className={cn(
        "grid shrink-0 place-items-center rounded-xl bg-brand-soft text-xs font-extrabold text-brand",
        className,
      )}
    >
      {initialsOf(name)}
    </span>
  );
}

function Avatar({ name, avatar }: { name: string; avatar: string }) {
  return (
    <Link
      href="/pengaturan"
      className="flex items-center gap-2.5 rounded-xl p-1 pr-2 transition-colors duration-200 hover:bg-surface-2"
      aria-label="Buka pengaturan"
    >
      <AvatarFace name={name} avatar={avatar} className="size-9" />
      <span className="hidden text-left leading-tight 2xl:block">
        <span className="block text-xs font-bold text-ink">{name}</span>
        <span className="block text-[10px] text-ink-faint">Akun lokal</span>
      </span>
    </Link>
  );
}

/**
 * Satu-satunya jalan ke Pengaturan di ponsel.
 *
 * Bottom nav dikunci empat tab sesuai PRD, dan Pengaturan bukan salah satunya —
 * tanpa tombol ini, backup, restore, dan ganti nama sama sekali tidak bisa
 * dijangkau dari HP. Ikon gerigi kecil di pojok membedakannya dari avatar biasa,
 * supaya jelas ini pintu ke pengaturan dan bukan sekadar penanda profil.
 */
function MobileProfileButton({
  name,
  avatar,
  active,
}: {
  name: string;
  avatar: string;
  active: boolean;
}) {
  return (
    <Link
      href="/pengaturan"
      aria-label="Buka pengaturan, backup, dan ekspor data"
      aria-current={active ? "page" : undefined}
      className={cn(
        // 44px: batas minimum target sentuh yang nyaman untuk ibu jari.
        "relative grid size-11 shrink-0 place-items-center overflow-hidden rounded-xl text-xs font-extrabold",
        "transition-all duration-200 ease-out active:scale-95",
        avatar
          ? "bg-surface-2"
          : active
            ? "bg-brand text-on-brand"
            : "bg-brand-soft text-brand hover:bg-brand-tint",
      )}
    >
      {avatar ? (
        /* eslint-disable-next-line @next/next/no-img-element -- data URL lokal */
        <img src={avatar} alt="" className="size-full object-cover" />
      ) : (
        initialsOf(name)
      )}
      <span
        aria-hidden
        className={cn(
          "absolute -bottom-0.5 -right-0.5 grid size-4 place-items-center rounded-full border-2 border-bg",
          active ? "bg-on-brand text-brand" : "bg-brand text-on-brand",
        )}
      >
        <Settings className="size-2.5" />
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
        <MobileProfileButton
          name={state.settings.name}
          avatar={state.settings.avatar}
          active={pathname === "/pengaturan"}
        />
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
          <Avatar name={state.settings.name} avatar={state.settings.avatar} />
        </div>
      </div>
    </header>
  );
}
