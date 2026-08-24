"use client";

import type { ReactNode } from "react";
import { useHydration } from "@/lib/store";
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
export function AppShell({ children }: { children: ReactNode }) {
  useHydration();

  return (
    <ToastProvider>
      <TransactionSheetProvider>
        <div className="min-h-dvh bg-bg">
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
