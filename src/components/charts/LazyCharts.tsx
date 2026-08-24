"use client";

import dynamic from "next/dynamic";

/**
 * Recharts adalah bundel terbesar di aplikasi ini — sekitar 113 KB terkompresi,
 * lebih besar dari seluruh sisa halaman digabung. Padahal ketiga grafik yang
 * memakainya berada di bawah layar, sementara yang dibutuhkan pengguna sedetik
 * pertama adalah saldo, ring anggaran, dan tombol "Catat Transaksi".
 *
 * Memuatnya secara malas membuat bagian interaktif siap lebih dulu; grafiknya
 * menyusul beberapa ratus milidetik kemudian.
 *
 * Tinggi placeholder sengaja disamakan persis dengan tinggi grafiknya supaya
 * tidak ada pergeseran tata letak saat grafik masuk (CLS tetap nol).
 *
 * Ring anggaran TIDAK ikut dimuat malas: itu SVG buatan sendiri tanpa
 * dependensi, dan justru elemen utama yang harus tampil paling awal.
 */

function ChartFallback({ height }: { height: number }) {
  return <div className="dp-skeleton w-full rounded-xl" style={{ height }} aria-hidden />;
}

export const CashflowChart = dynamic(
  () => import("./TrendChart").then((m) => m.CashflowChart),
  { ssr: false, loading: () => <ChartFallback height={240} /> },
);

export const NetBarChart = dynamic(() => import("./TrendChart").then((m) => m.NetBarChart), {
  ssr: false,
  loading: () => <ChartFallback height={240} />,
});

export const BurnChart = dynamic(() => import("./TrendChart").then((m) => m.BurnChart), {
  ssr: false,
  loading: () => <ChartFallback height={150} />,
});
