"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useHydration, useStore } from "@/lib/store";
import { ToastProvider } from "@/components/ui/Toast";
import { TransactionSheetProvider } from "@/components/transaction/TransactionSheetProvider";
import { BottomNav } from "./BottomNav";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";

/**
 * One shell, two silhouettes:
 * - below `lg` a 430px mobile app with a bottom tab bar (PRD §2)
 * - from `lg` up a full admin dashboard with a fixed sidebar rail
 *
 * Tidak ada gerbang login: aplikasi langsung terbuka ke Beranda, membaca
 * localStorage lewat `useHydration()`. Sampai hidrasi selesai setiap halaman
 * menampilkan skeleton, jadi tidak ada kedipan konten kosong.
 */
/**
 * Peringatan penyimpanan gagal.
 *
 * Tanpa server, satu-satunya salinan data ada di localStorage. Kalau
 * penulisannya ditolak — kuota penuh, atau mode penyamaran — aplikasi tetap
 * terlihat normal karena datanya masih ada di memori, lalu semuanya hilang
 * begitu tab ditutup. Karena itu kegagalannya ditempel di atas layar dan tidak
 * bisa ditutup: satu-satunya jalan keluar adalah mengambil backup.
 */
function SaveFailedBanner() {
  const { saveFailed } = useStore();
  if (!saveFailed) return null;

  return (
    <div
      role="alert"
      className="dp-safe-top sticky top-0 z-30 px-4 py-2.5 text-center"
      style={{ background: "var(--danger)", color: "var(--on-danger)" }}
    >
      <p className="text-[11px] font-bold leading-snug">
        Perubahan terakhir TIDAK tersimpan — penyimpanan browser penuh atau diblokir.
      </p>
      <Link href="/pengaturan" className="text-[11px] font-semibold underline underline-offset-2">
        Ambil backup sekarang sebelum data hilang
      </Link>
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  useHydration();

  return (
    <ToastProvider>
      <TransactionSheetProvider>
        <div className="dp-no-print min-h-dvh bg-bg">
          <SaveFailedBanner />
          <Sidebar />

          <div className="lg:pl-[264px]">
            <Topbar />
            <main
              id="konten"
              className="mx-auto w-full max-w-app px-4 pb-32 pt-4 lg:max-w-shell lg:px-8 lg:pb-12 lg:pt-6"
            >
              {children}
            </main>
          </div>

          <BottomNav />
        </div>
      </TransactionSheetProvider>
    </ToastProvider>
  );
}

/** Page heading used inside the mobile viewport (desktop shows it in the topbar). */
export function PageIntro({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-4 flex items-end justify-between gap-3 lg:hidden">
      <div className="min-w-0">
        <h1 className="text-xl font-extrabold tracking-tight text-ink">{title}</h1>
        <p className="mt-0.5 text-xs text-ink-muted">{description}</p>
      </div>
      {action}
    </div>
  );
}
