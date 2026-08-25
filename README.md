# Dompet — Personal Finance Dashboard

Dashboard keuangan pribadi **mobile-first** (PWA) untuk mencatat transaksi harian, mengatur anggaran bulanan, dan mengejar target tabungan. Dibangun dengan Next.js App Router + Tailwind CSS v4, tanpa server dan tanpa biaya bulanan — semua data hidup di perangkat pengguna.

Satu basis kode, dua wajah:

| Layar | Tampilan |
|---|---|
| `< 1024px` | Aplikasi mobile lebar maksimal **430px**, terpusat, dengan bottom navigation 4 tab + tombol aksi cepat |
| `≥ 1024px` | Admin dashboard penuh: sidebar tetap, topbar dengan pencarian, dan grid kartu 12 kolom |

Tiga tema bawaan: **Warm** (krem–terakota, minimalis-organik), **Midnight** (indigo pekat dengan aksen terakota), dan **Glass** (panel buram bergaya iOS di atas latar bergradien).

---

## Fitur

**Beranda**
- Header saldo likuid, pemasukan, dan pengeluaran bulan berjalan
- **Angka utama bisa diganti** — ketuk labelnya untuk memilih Saldo likuid, Keluar, Masuk, Sisa (masuk−keluar), atau Sisa anggaran. Dua angka pendamping ikut menyesuaikan supaya tidak ada nominal yang tampil dua kali dalam satu kartu; pilihannya tersimpan
- **Ring Anggaran vs Realisasi** — donut SVG interaktif; tiap segmen adalah satu kategori, arahkan kursor (atau fokus keyboard) untuk melihat rinciannya di tengah ring
- Indikator warna dinamis: hijau `<70%`, kuning `70–90%`, merah `>90%`
- Empat kartu metrik: realisasi, plafon, sisa aman, dan jatah harian — **semuanya bisa diketuk** menuju halaman yang bisa menindaklanjutinya
- Grafik yang bisa ditukar: **laju pengeluaran kumulatif** vs laju ideal, atau **perbandingan 6 bulan** dengan bulan berjalan disorot dan kalimat pembanding terhadap rata-rata
- Arus kas 6 bulan dan sisa (surplus/defisit) per bulan
- Lima aktivitas terkini dan ringkasan target tabungan
- Tombol **+ Catat Transaksi** membuka bottom sheet: nominal, in/out, kategori, catatan, tanggal

**Anggaran**
- Plafon per kategori, ketuk baris mana pun untuk mengubahnya — tiap baris berikon pensil supaya jelas bisa diketuk
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
- Ekspor dalam **lima format** sesuai filter yang aktif — lihat di bawah

**Pengaturan**
- **Foto profil** dengan pemotong sendiri — geser dan atur zoom untuk memilih bagiannya, lalu disimpan sebagai persegi 128px (930 KB jadi ~2 KB)
- Nama panggilan, tema, dan mode sembunyikan nominal
- **Backup & Kirim** lewat share sheet — backup langsung ke WhatsApp, email, atau Drive
- Kartu **Keamanan Data**: status penyimpanan permanen, pengingat backup, dan tombol urungkan
- Muat ulang data demo, hapus semua data, ringkasan isi database lokal

**Ekspor lima format** — semuanya tanpa dependency tambahan
| Format | Kegunaan |
|---|---|
| **PDF** | Laporan cetak lewat mesin cetak browser: kop, ringkasan, rekap anggaran, rincian transaksi |
| **Excel (.xlsx)** | File xlsx asli — nominal sebagai angka, tanggal sebagai tanggal, baris judul dibekukan |
| **Gambar (PNG)** | Kartu rekap bulanan 1080×1350 yang digambar di canvas, dirancang untuk dibagikan |
| **CSV** | Format polos untuk aplikasi lain |
| **JSON** | Backup penuh untuk pindah perangkat |

**Impor dari aplikasi lain**
- **Excel (.xlsx) dibaca langsung** — tanpa dikonversi ke CSV dulu. Pembaca ZIP + XML sendiri, nol dependency; tanggal serial Excel dan tabel shared string ditangani
- Baca CSV/TSV dari pencatat keuangan mana pun — pemisah koma, titik koma, atau tab
- Nominal `Rp 25.000`, `25,000.00`, `25.000,50`, `(25.000)`, dan `40000.0` semuanya terbaca
- Tanggal `DD/MM/YYYY`, `MM/DD/YYYY`, ISO, `24 Agustus 2026`, dan serial Excel
- Kategori ber-emoji seperti `🍔 Food` atau `💄 Beauty` dicocokkan ke kategori bawaan, dengan padanan yang sadar arah uang — *Gift* sebagai pengeluaran jadi Belanja, sebagai pemasukan jadi Hadiah
- Kolom `Income/Expense` dikenali sebagai kolom tipe, bukan kolom nominal
- Arah uang disimpulkan dari kolom tipe, tanda plus/minus, atau nama kategori
- Kolom ditebak otomatis, **ditampilkan untuk dikoreksi**, lengkap dengan pratinjau sebelum apa pun tersimpan

Ekspor dari **Money Manager**, **Wallet**, dan sejenisnya bisa langsung dipilih apa adanya.

**Impor rekening koran PDF** — tanpa dependency PDF apa pun
- Teks diambil langsung dari PDF memakai `DecompressionStream` bawaan browser, termasuk font ter-*subset* lewat tabel `/ToUnicode`
- Tabel dikenali dari posisi teks: tanggal, keterangan, dan kolom nominal dipisah berdasarkan koordinat, bukan spasi
- **Kolom saldo berjalan dideteksi dan sengaja tidak dipetakan** — mengimpor saldo sebagai nominal adalah cara tercepat merusak catatan
- Gaya `250.000,00 DB` / `CR` terbaca sebagai arah uang; tanggal tanpa tahun dilengkapi dari periode dokumen
- Hasilnya masuk ke wizard koreksi yang sama dengan CSV — tetap ditampilkan sebelum disimpan
- PDF hasil scan dan PDF terkunci password ditolak dengan pesan yang menjelaskan langkah berikutnya, bukan error mentah

**Ketahanan data** — karena tanpa server, kehilangan data tidak bisa dipulihkan siapa pun
- **Penyimpanan permanen** diminta lewat `navigator.storage.persist()`, supaya browser tidak membuang data saat memori perangkat menipis
- **Urungkan** untuk setiap tindakan merusak: Hapus semua, Muat demo, Impor "Ganti semua", dan Pulihkan backup semuanya menyimpan snapshot lebih dulu
- **Pengingat backup** yang menghitung transaksi sejak backup terakhir
- Kartu **Keamanan Data** di Pengaturan menampilkan status penyimpanan, kuota terpakai, dan waktu backup terakhir
- Data tersimpan yang rusak tidak pernah ditimpa diam-diam
- Saklar `DEMO_DATA_ON_FIRST_RUN` di `src/lib/config.ts` — **setel `false` sebelum menyerahkan ke pengguna sungguhan**, lihat [CUSTOMIZATION.md](CUSTOMIZATION.md#9-memasang-untuk-pengguna-sungguhan-bukan-demo)

**Lain-lain**
- PWA: manifest, service worker offline, ikon maskable, shortcut aplikasi
- Aksesibel: target sentuh ≥44px, fokus keyboard terlihat, `aria-label` pada semua kontrol ikon, status tidak pernah hanya bergantung pada warna
- `prefers-reduced-motion` dihormati di seluruh animasi
- Data demo 6 bulan pada kunjungan pertama — bisa dimatikan lewat `src/lib/config.ts`

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
│   ├── transaction/          Bottom sheet catat/edit transaksi + daftar
│   └── export/               Lembar ekspor, wizard impor, tata letak cetak
│
└── lib/
    ├── types.ts              Tipe domain
    ├── categories.ts         ⭐ Daftar kategori — tambah kategori di sini
    ├── hero-metrics.ts       ⭐ Pilihan angka utama di kartu Beranda
    ├── format.ts             Format rupiah, tanggal, ambang status anggaran
    ├── stats.ts              Semua perhitungan turunan (murni, mudah diuji)
    ├── store.ts              State + persistensi localStorage
    ├── seed.ts               Data demo
    ├── export.ts             Penyaluran berkas (share sheet + unduhan), CSV, JSON
    ├── hooks.ts              Hook bulan berjalan, reduced-motion, mounted
    ├── nav.ts                Konfigurasi navigasi
    ├── config.ts             ⭐ Saklar data demo & pengingat backup
    ├── durability.ts         Penyimpanan permanen, urungkan, jejak backup
    └── formats/
        ├── zip.ts            Penulis ZIP minimal (dasar .xlsx)
        ├── xlsx.ts           Pembuat file Excel asli
        ├── recap.ts          Kartu rekap PNG di canvas
        ├── csv-import.ts     Parser impor dari aplikasi lain
        ├── xlsx-import.ts    Pembaca .xlsx (ZIP + XML, tanpa dependency)
        └── pdf-import.ts     Pembaca rekening koran PDF
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
