"use client";

import { useEffect } from "react";

/**
 * Mendaftarkan cache offline, hanya di produksi — di dev, service worker yang
 * basi berkelahi dengan hot reload.
 *
 * Sekaligus menangani pembaruan. Aplikasi yang sudah dipasang ke layar utama
 * bisa berhari-hari tidak pernah dimuat ulang penuh, jadi tanpa penanganan ini
 * perbaikan yang sudah kamu deploy tidak akan pernah sampai ke penggunanya.
 * Alurnya: periksa versi baru saat aplikasi dibuka dan setiap kali kembali dari
 * latar belakang, lalu muat ulang begitu service worker baru mengambil alih.
 */
export function RegisterServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;

    let registration: ServiceWorkerRegistration | null = null;
    let reloading = false;

    /*
     * `controllerchange` menyala saat service worker baru mengambil alih.
     * Muat ulang sekali supaya JS dan CSS yang sedang berjalan ikut versi baru
     * — tanpa ini pengguna melihat cangkang lama sampai menutup aplikasinya.
     * Penjaga `reloading` mencegah putaran muat ulang tanpa henti.
     */
    const onControllerChange = () => {
      if (reloading) return;
      reloading = true;
      window.location.reload();
    };

    const checkForUpdate = () => {
      if (document.visibilityState === "visible") {
        registration?.update().catch(() => {
          // Sedang offline. Pemeriksaan berikutnya akan mencoba lagi.
        });
      }
    };

    const onLoad = () => {
      navigator.serviceWorker
        .register("/sw.js")
        .then((reg) => {
          registration = reg;
          // Aplikasi yang dipasang ke layar utama sering dibuka tanpa memuat
          // ulang halaman, jadi periksa juga tiap kali kembali dari latar.
          document.addEventListener("visibilitychange", checkForUpdate);
        })
        .catch(() => {
          // Dukungan offline itu bonus; aplikasi tetap jalan tanpanya.
        });
    };

    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);
    window.addEventListener("load", onLoad);

    return () => {
      navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
      window.removeEventListener("load", onLoad);
      document.removeEventListener("visibilitychange", checkForUpdate);
    };
  }, []);

  return null;
}
