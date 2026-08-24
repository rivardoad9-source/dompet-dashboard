# Dompet — Personal Finance Dashboard

Dashboard keuangan pribadi **mobile-first** (PWA) untuk mencatat transaksi harian, mengatur anggaran bulanan, dan mengejar target tabungan. Dibangun dengan Next.js App Router + Tailwind CSS v4, tanpa server dan tanpa biaya bulanan — semua data hidup di perangkat pengguna.

Satu basis kode, dua wajah:

| Layar | Tampilan |
|---|---|
| `< 1024px` | Aplikasi mobile lebar maksimal **430px**, terpusat, dengan bottom navigation 4 tab + tombol aksi cepat |
| `≥ 1024px` | Admin dashboard penuh: sidebar tetap, topbar dengan pencarian, dan grid kartu 12 kolom |

Dua tema bawaan: **Warm** (krem–terakota, minimalis-organik) dan **Midnight** (indigo pekat dengan aksen terakota).

---

## Fitur

**Beranda**
- Header saldo likuid, pemasukan, dan pengeluaran bulan berjalan
- **Ring Anggaran vs Realisasi** — donut SVG interaktif; tiap segmen adalah satu kategori, arahkan kursor (atau fokus keyboard) untuk melihat rinciannya di tengah ring
- Indikator warna dinamis: hijau `<70%`, kuning `70–90%`, merah `>90%`
- Empat kartu metrik: realisasi, plafon, sisa aman, dan jatah harian
- Grafik laju pengeluaran kumulatif vs laju ideal
- Arus kas 6 bulan dan sisa (surplus/defisit) per bulan
- Lima aktivitas terkini dan ringkasan target tabungan
- Tombol **+ Catat Transaksi** membuka bottom sheet: nominal, in/out, kategori, catatan, tanggal

**Anggaran**
- Plafon per kategori, ketuk baris mana pun untuk mengubahnya
- Progress bar yang tetap terbaca saat melewati 100% (kelebihan digambar berarsir)
- Peringatan otomatis untuk kategori yang mendekati atau melewati limit
- Komposisi seluruh pengeluaran bulan itu, termasuk kategori tanpa plafon

**Tabungan**
- Kartu target dengan progres dana terkumpul vs target
- **Kalkulator rekomendasi** setoran bulanan agar target tercapai tepat waktu
- Riwayat setoran per target, bisa dihapus satu per satu

**Riwayat**
- Filter bulan, tipe (masuk/keluar), kategori, dan pencarian teks
- Transaksi dikelompokkan per hari dengan total harian
- Edit dan hapus (dengan **Urungkan**)
- Ekspor **CSV/Excel** sesuai filter yang aktif

**Pengaturan**
- Nama panggilan, tema, dan mode sembunyikan nominal
- Backup & pulihkan JSON, muat ulang data demo, hapus semua data
- Ringkasan isi database lokal

**Lain-lain**
- PWA: manifest, service worker offline, ikon maskable, shortcut aplikasi
- Aksesibel: target sentuh ≥44px, fokus keyboard terlihat, `aria-label` pada semua kontrol ikon, status tidak pernah hanya bergantung pada warna
- `prefers-reduced-motion` dihormati di seluruh animasi
- Data demo 6 bulan yang dibuat otomatis pada kunjungan pertama

---

## Menjalankan secara lokal

Butuh **Node.js 20.9+** (disarankan 22 LTS atau lebih baru).

```bash
npm install
```

```bash
npm run dev
```

Buka <http://localhost:3000>.

Perintah lain:

```bash
npm run build
```

```bash
npm run start
```

```bash
npm run lint
```

Regenerasi ikon PWA setelah mengganti warna brand:

```bash
npm run icons
```


---

## Deploy 1-klik ke Vercel

1. Push repo ini ke GitHub (repositori boleh privat).
2. Buka <https://vercel.com/new>, pilih repo tersebut.
3. Biarkan semua pengaturan default — Vercel mendeteksi Next.js otomatis. **Tidak ada satu pun environment variable yang perlu diisi.**
4. Klik **Deploy**.

Selesai. Setiap `git push` berikutnya akan otomatis membuat preview deployment, dan push ke branch utama akan naik ke production.

Netlify juga bisa: build command `npm run build`, publish directory `.next`, plus plugin `@netlify/plugin-nextjs`.

---

## Struktur proyek

```
src/
├── app/
│   ├── layout.tsx            Root layout, font, metadata PWA, bootstrap tema
│   ├── globals.css           ⭐ SEMUA token desain ada di sini
│   ├── page.tsx              Beranda
│   ├── anggaran/page.tsx     Anggaran
│   ├── tabungan/page.tsx     Tabungan
│   ├── riwayat/page.tsx      Riwayat
│   └── pengaturan/page.tsx   Pengaturan
│
├── components/
│   ├── shell/                AppShell, Sidebar, Topbar, BottomNav, Logo
│   ├── ui/                   Card, Button, Sheet, Field, Toast, Progress, …
│   ├── charts/               BudgetRing (SVG kustom), TrendChart (Recharts)
│   ├── home/                 Kartu-kartu beranda
│   ├── budget/               Editor plafon
│   ├── savings/              Kartu target + sheet setoran/riwayat
│   └── transaction/          Bottom sheet catat/edit transaksi + daftar
│
└── lib/
    ├── types.ts              Tipe domain
    ├── categories.ts         ⭐ Daftar kategori — tambah kategori di sini
    ├── format.ts             Format rupiah, tanggal, ambang status anggaran
    ├── stats.ts              Semua perhitungan turunan (murni, mudah diuji)
    ├── store.ts              State + persistensi localStorage
    ├── seed.ts               Data demo
    ├── export.ts             Ekspor CSV & backup JSON
    ├── hooks.ts              Hook bulan berjalan, reduced-motion, mounted
    └── nav.ts                Konfigurasi navigasi
```

Aturan yang dipegang di seluruh kode: **komponen tidak pernah menulis warna mentah.** Semuanya membaca CSS custom property, sehingga mengganti brand cukup di satu blok.

---

## Tech stack

| Bagian | Pilihan | Alasan |
|---|---|---|
| Framework | Next.js 16 (App Router, Turbopack) | Semua halaman ter-prerender statis, cepat, dan mudah dipahami pembeli |
| Styling | Tailwind CSS v4 (CSS-first) | Tidak ada `tailwind.config.js`; token langsung di `globals.css` |
| Ikon | `lucide-react` | Konsisten, tree-shakeable, tanpa emoji sebagai ikon |
| Grafik | SVG kustom (ring) + `recharts` | Ring ringan dan sepenuhnya bisa distyle; Recharts untuk grafik garis/batang |
| Font | Plus Jakarta Sans via `next/font` | Self-hosted otomatis, angka tabular, tanpa layout shift |
| Data | `localStorage` + `useSyncExternalStore` | Nol biaya server, nol konfigurasi; lapisan simpan terisolasi di dua fungsi kalau mau ditukar |

Total dependency runtime: **lima** (`next`, `react`, `react-dom`, `lucide-react`, `recharts`). Tidak ada state manager, tidak ada UI kit, tidak ada utility library.

---

## Penyimpanan data

Semua data disimpan di `localStorage` dengan kunci `dompet.state.v1` sebagai satu objek JSON:

```jsonc
{
  "transactions": [ /* … */ ],
  "budgets":      [ /* … */ ],
  "goals":        [ /* … */ ],
  "settings":     { "name": "…", "theme": "warm", "privacy": false }
}
```

Tidak ada akun, tidak ada login, tidak ada server. Aplikasi terbuka langsung ke Beranda dan pengguna bisa mencatat detik itu juga.

Konsekuensinya jujur: data tidak ikut berpindah perangkat, dan menghapus cache browser akan menghapusnya. Untuk itulah **Pengaturan → Backup JSON** dan **Pulihkan dari JSON** ada — ekspor di HP lama, impor di HP baru. Ekspor **CSV/Excel** juga tersedia di tab Riwayat kalau datanya hanya perlu diolah di spreadsheet.

Skema di-*reconcile* saat dibaca, jadi data lama tetap terbaca setelah kamu menambah field baru.

---

## Kustomisasi

Ganti warna brand, tambah kategori, ubah font, ganti mata uang, atau tambah halaman baru — semuanya ada di **[CUSTOMIZATION.md](CUSTOMIZATION.md)**.

---

## Catatan lisensi

Template ini dijual sebagai produk digital. Pembeli boleh memakainya untuk proyek pribadi maupun komersial, termasuk untuk klien. Yang tidak diperbolehkan adalah menjual ulang atau mendistribusikan kembali source code-nya sebagai template. Sesuaikan paragraf ini dengan ketentuan tokomu sebelum rilis.
