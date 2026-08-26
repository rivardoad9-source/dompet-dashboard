"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";
import { formatCompact, monthLabel, todayISO } from "@/lib/format";
import type { DaySummary } from "@/lib/stats";
import type { Transaction } from "@/lib/types";
import { DayDetailSheet } from "./DayDetailSheet";

/**
 * Kalender pengeluaran harian.
 *
 * Grafik laju menjawab "seberapa cepat bulan ini" dan grafik banding menjawab
 * "seberapa boros dibanding biasanya". Keduanya tidak bisa menjawab "Selasa
 * kemarin habis berapa" — dan itu pertanyaan yang paling sering muncul. Di sini
 * tiap tanggal punya kotaknya sendiri, dan mengetuknya membuka rinciannya.
 *
 * Senin jadi kolom pertama, mengikuti konvensi kalender Indonesia.
 */

const HEADS = ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"];

export function DailyCalendar({
  days,
  transactions,
  monthKey: key,
  privacy,
}: {
  days: DaySummary[];
  transactions: Transaction[];
  monthKey: string;
  privacy: boolean;
}) {
  const [openIso, setOpenIso] = useState<string | null>(null);

  const today = todayISO();
  // Terboros bulan itu jadi acuan tint, jadi skalanya selalu relatif terhadap
  // kebiasaan bulan berjalan — bukan ambang tetap yang tidak berarti apa-apa.
  const peak = days.reduce((max, d) => Math.max(max, d.expense), 0);

  // getDay(): 0 = Minggu. Digeser agar Senin bernilai 0.
  const [y, m] = key.split("-").map(Number);
  const lead = (new Date(y, m - 1, 1).getDay() + 6) % 7;

  return (
    <div>
      <div className="grid grid-cols-7 gap-1">
        {HEADS.map((h) => (
          <div
            key={h}
            className="pb-1 text-center text-[10px] font-bold uppercase tracking-wider text-ink-faint"
          >
            {h}
          </div>
        ))}

        {Array.from({ length: lead }, (_, i) => (
          <div key={`kosong-${i}`} aria-hidden />
        ))}

        {days.map((d) => {
          const spent = d.expense > 0;
          const isToday = d.iso === today;
          // Akar kuadrat, bukan linear: satu hari yang jauh lebih boros dari
          // biasanya kalau tidak begini membuat semua hari lain terlihat kosong.
          const intensity = peak > 0 && spent ? Math.sqrt(d.expense / peak) : 0;

          return (
            <button
              key={d.iso}
              type="button"
              onClick={() => setOpenIso(d.iso)}
              aria-label={`${d.day} ${monthLabel(key)}, keluar ${
                privacy ? "disembunyikan" : formatCompact(d.expense)
              }`}
              className={cn(
                "relative flex aspect-square cursor-pointer flex-col items-center justify-center gap-0.5",
                "overflow-hidden rounded-lg px-0.5 transition-transform duration-200 active:scale-95",
                isToday && "ring-2 ring-brand ring-offset-1 ring-offset-[var(--surface)]",
              )}
              style={{
                background: spent
                  ? `color-mix(in oklab, var(--brand) ${Math.round(14 + intensity * 62)}%, var(--surface-2))`
                  : "var(--surface-2)",
              }}
            >
              <span
                className={cn(
                  "text-[11px] font-bold leading-none",
                  intensity > 0.55 ? "text-on-brand" : "text-ink",
                )}
              >
                {d.day}
              </span>

              {spent ? (
                <span
                  className={cn(
                    "max-w-full truncate text-[8.5px] font-semibold leading-none",
                    intensity > 0.55 ? "text-on-brand opacity-90" : "text-ink-muted",
                  )}
                >
                  {privacy ? "••" : formatCompact(d.expense).replace("Rp ", "")}
                </span>
              ) : d.income > 0 ? (
                /* Hari yang hanya berisi pemasukan tidak boleh terbaca sebagai
                   hari kosong — titik hijau membedakannya. */
                <span
                  aria-hidden
                  className="size-1.5 rounded-full"
                  style={{ background: "var(--success)" }}
                />
              ) : null}
            </button>
          );
        })}
      </div>

      <DayDetailSheet
        iso={openIso}
        transactions={transactions}
        privacy={privacy}
        onClose={() => setOpenIso(null)}
      />
    </div>
  );
}
