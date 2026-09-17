# Panduan Kustomisasi

Semua yang biasa ingin kamu ubah ada di **empat file**:

| Mau ubah apa | Buka file ini |
|---|---|
| Warna, radius, bayangan, tema | `src/app/globals.css` |
| Kategori pemasukan & pengeluaran | `src/lib/categories.ts` |
| Mata uang, format tanggal, ambang status | `src/lib/format.ts` |
| Menu navigasi | `src/lib/nav.ts` |

Sisanya — komponen, halaman, grafik — membaca dari keempat file itu. Tidak ada warna mentah yang ditulis langsung di komponen mana pun.

---

## 1. Mengganti warna brand

Buka `src/app/globals.css`. Di paling atas ada tiga blok token: `:root` (tema **Mono**, sekaligus fallback), `[data-theme="midnight"]` (tema **Midnight**), dan `[data-theme="glass"]` (tema **Glass**).

Khusus tema Mono, tokennya dua lapis: `:root` mengatur halaman (putih), dan blok `--panel-*` mengatur kartu, sheet, dan bottom nav (hitam). Aturan `.dp-card` di bagian Utilities meng-alias `--panel-*` menjadi `--surface`/`--ink` di dalam subtree panel, jadi satu kelas `text-ink` menghasilkan hitam di halaman dan putih di dalam kartu. Kalau kamu mengubah warna panel, ubah `--panel-*` — bukan aturan `.dp-card`-nya.

Untuk rebrand cepat, ubah lima baris ini di `:root`:

```css
:root {
  --brand:        #c2dc70;  /* warna utama: tombol, tab aktif, ring */
  --brand-strong: #b3cf5c;  /* varian hover */
  --brand-soft:   #282e16;  /* keping gelap: badge, chip, avatar */
  --brand-tint:   #383f1f;  /* hover di atas brand-soft */
  --on-brand:     #101405;  /* teks/ikon DI ATAS --brand */
}
```

> **Cek kontras.** `--on-brand` di atas `--brand` harus mencapai rasio minimal **4.5:1**. Kalau kamu memilih brand yang terang (kuning, lime, cyan), ganti `--on-brand` jadi warna gelap, bukan putih. Uji cepat di <https://webaim.org/resources/contrastchecker/>.

Kartu saldo besar di Beranda memakai gradasi terpisah:

```css
--hero-from:      #2a2a2e;  /* gradasi awal (kiri atas) */
--hero-to:        #17171a;  /* gradasi akhir (kanan bawah) */
--hero-ink:       #f4f4f3;  /* teks di atas gradasi */
--hero-ink-muted: #a6a6aa;  /* label sekunder di atas gradasi */
```

Setelah warna brand berubah, regenerasi ikon PWA supaya ikut cocok:

```bash
npm run icons
```

Skrip itu membaca `BRAND` dan `CREAM` di bagian atas `scripts/generate-icons.mjs` — samakan dengan nilai `--brand` dan `--bg` milikmu, lalu jalankan ulang.

### Warna semantik

```css
--success: #2e7d32;   /* pemasukan, target tercapai, status "Aman" */
--warning: #b47216;   /* status "Waspada" (70–90% anggaran) */
--danger:  #c62828;   /* pengeluaran, status "Overbudget", tombol hapus */
```

Setiap warna semantik punya pasangan `-soft` untuk latar badge. Ubah keduanya bersamaan.

### Palet grafik

Delapan warna kategori dipakai oleh ring anggaran, progress bar, dan ikon kategori:

```css
--cat-1 … --cat-8
```

Pilih hue yang **jelas berbeda satu sama lain**, bukan gradasi dari satu warna — kalau tidak, ring donut jadi tidak terbaca. Definisikan di kedua tema; versi Midnight perlu lebih terang agar tetap kontras di latar gelap.

### Bentuk & bayangan

```css
@theme inline {
  --radius-card: 1.25rem;   /* sudut kartu → utility `rounded-card` */
  --radius-pill: 999px;     /* badge & chip → `rounded-pill` */
  --container-app: 430px;   /* lebar maksimal mobile (PRD) → `max-w-app` */
  --container-shell: 1440px;/* lebar maksimal desktop → `max-w-shell` */
}
```

Mau tampilan lebih tegas? Turunkan `--radius-card` ke `0.5rem`. Mau lebih lembut? Naikkan ke `1.75rem`.

---

## 2. Menambah atau mengubah kategori

Buka `src/lib/categories.ts` dan tambahkan satu baris ke array `CATEGORIES`:

```ts
import { PawPrint } from "lucide-react";

export const CATEGORIES: Category[] = [
  // …kategori yang sudah ada
  { id: "hewan", label: "Hewan Peliharaan", type: "out", icon: PawPrint, colorVar: "--cat-2" },
];
```

| Field | Keterangan |
|---|---|
| `id` | Unik dan **permanen** — tersimpan di setiap transaksi. Jangan diganti setelah ada data. |
| `label` | Teks yang dilihat pengguna. Aman diubah kapan saja. |
| `type` | `"out"` (pengeluaran) atau `"in"` (pemasukan). |
| `icon` | Komponen dari `lucide-react`. Cari ikonnya di <https://lucide.dev/icons>. |
| `colorVar` | Salah satu dari `--cat-1` … `--cat-8`. |

Kategori baru langsung muncul di picker transaksi, filter riwayat, ring anggaran, dan daftar komposisi. **Tidak ada file lain yang perlu disentuh.**

Untuk memberi plafon bawaan pada kategori baru, tambahkan ke `DEFAULT_BUDGETS` di `src/lib/seed.ts`:

```ts
{ categoryId: "hewan", limit: 400_000 },
```

Menghapus kategori aman dilakukan — transaksi lama yang menunjuk ke id yang hilang otomatis jatuh ke "Lainnya" lewat fungsi `getCategory()`.

---

## 3. Mengganti font

Font diatur di `src/app/layout.tsx` lewat `next/font/google` (self-hosted otomatis, tanpa request ke Google saat runtime):

```ts
import { Plus_Jakarta_Sans } from "next/font/google";

const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
  display: "swap",
});
```

Untuk mengganti, misalnya ke Inter:

```ts
import { Inter } from "next/font/google";

const jakarta = Inter({ variable: "--font-jakarta", subsets: ["latin"], display: "swap" });
```

Biarkan nama variabelnya `--font-jakarta` supaya `globals.css` tidak perlu diubah. Kalau mau menamai ulang, sesuaikan juga baris ini:

```css
--font-sans: var(--font-jakarta), ui-sans-serif, system-ui, sans-serif;
```

> Pilih font yang punya **angka tabular**. Kolom nominal akan bergoyang saat animasi hitung-naik kalau lebar digitnya tidak sama. Plus Jakarta Sans, Inter, IBM Plex Sans, dan Roboto semuanya aman.

---

## 4. Mengganti mata uang & bahasa

Semua pemformatan angka ada di `src/lib/format.ts`. Untuk pindah ke Ringgit Malaysia:

```ts
const IDR = new Intl.NumberFormat("ms-MY", {
  style: "currency",
  currency: "MYR",
  maximumFractionDigits: 2,
});
```

Tiga hal lain yang perlu ikut disesuaikan di file yang sama:

1. **`formatCompact()` dan `formatAxis()`** — keduanya memakai singkatan `rb` / `jt` (ribu / juta). Ganti ke `k` / `M` atau apa pun yang sesuai.
2. **Array `MONTHS` dan `DAYS`** — nama bulan dan hari dalam bahasa Indonesia.
3. **`MASK`** — teks pengganti saat mode privasi aktif (`"Rp ••••••"`).

Untuk menerjemahkan antarmuka, teks UI ditulis langsung di komponen (tanpa i18n library, supaya template tetap ringan). Cari string berbahasa Indonesia di `src/app/**` dan `src/components/**`. Kalau butuh multi-bahasa sungguhan, `next-intl` cocok dipasang di atas struktur ini.

Terakhir, ganti `lang="id"` di `src/app/layout.tsx` dan `"lang": "id"` di `public/manifest.webmanifest`.

---

## 5. Mengubah ambang status anggaran

Default mengikuti PRD: hijau di bawah 70%, kuning 70–90%, merah di atas 90%. Ada di `src/lib/format.ts`:

```ts
export function budgetStatus(pct: number): BudgetStatus {
  if (pct > 90) return "over";
  if (pct >= 70) return "warning";
  return "safe";
}
```

Label yang menyertainya ada tepat di bawahnya, di `STATUS_META`.

---

## 6. Menambah halaman baru

1. Buat `src/app/laporan/page.tsx`:

   ```tsx
   "use client";

   import { useStore } from "@/lib/store";
   import { PageIntro } from "@/components/shell/AppShell";
   import { Card, CardBody, CardHeader } from "@/components/ui/Card";

   export default function LaporanPage() {
     const { state, hydrated } = useStore();
     if (!hydrated) return null;

     return (
       <div className="space-y-4 lg:space-y-5">
         <PageIntro title="Laporan" description="Ringkasan tahunan" />
         <Card>
           <CardHeader title="Contoh" subtitle={`${state.transactions.length} transaksi`} />
           <CardBody>…</CardBody>
         </Card>
       </div>
     );
   }
   ```

2. Daftarkan di `src/lib/nav.ts`:

   ```ts
   { href: "/laporan", label: "Laporan", icon: FileBarChart, primary: false },
   ```

`primary: true` menaruhnya di bottom navigation mobile, `false` hanya di sidebar desktop.

> **Jaga bottom nav tetap 4 tab.** Lebih dari lima tab membuat target sentuh menyempit di bawah 44px dan melanggar pedoman navigasi mobile. Halaman tambahan sebaiknya `primary: false`.

Selalu tunggu `hydrated` sebelum merender data. Semua halaman di-prerender statis, jadi render pertama terjadi tanpa akses ke `localStorage`.

---

## 7. Mengganti data demo

Data contoh dibuat sekali saat kunjungan pertama, di `src/lib/seed.ts`. Yang bisa disetel:

- `DEFAULT_BUDGETS` — plafon awal per kategori
- `CATEGORY_WEIGHTS` — seberapa sering dan sebesar apa tiap kategori muncul
- `EXPENSE_NOTES` — contoh catatan transaksi
- `buildSeedGoals()` — target tabungan bawaan
- Nominal gaji di `buildSeedTransactions()` (default `8_500_000`)

Angka acaknya deterministik (`mulberry32` dengan seed tetap), jadi dataset demo identik di setiap perangkat — screenshot marketing kamu akan selalu sama.

**Untuk memulai kosong**, ganti satu baris di `src/lib/store.ts`:

```ts
next = raw ? reconcile(JSON.parse(raw)) : buildSeedState();
// menjadi
next = raw ? reconcile(JSON.parse(raw)) : emptyState();
```

Setiap halaman sudah punya empty state yang rapi, jadi aplikasi tetap enak dilihat tanpa data.

---

## 8. Backup, pindah perangkat, dan batas localStorage

Aplikasi ini sengaja tidak punya server. Semua data hidup di `localStorage` browser dengan satu kunci, `dompet.state.v1`. Konsekuensinya perlu dipahami dan disampaikan ke pengguna akhir:

- Data **tidak** ikut berpindah antar-perangkat atau antar-browser dengan sendirinya.
- Menghapus cache/data situs akan menghapusnya.
- Mode penyamaran (incognito) kehilangan data saat jendela ditutup.

Karena itu tab **Pengaturan** menyediakan tiga jalur:

| Tombol | Gunanya |
|---|---|
| **Backup JSON** | Menyimpan seluruh isi store (transaksi, anggaran, target, preferensi) ke satu file |
| **Pulihkan dari JSON** | Menimpa data saat ini dengan isi file backup — inilah cara pindah HP |
| **Ekspor CSV / Excel** | Untuk diolah di spreadsheet, bukan untuk dipulihkan kembali |

Alur pindah perangkat: buka Pengaturan di perangkat lama → Backup JSON → kirim filenya ke diri sendiri → buka aplikasi di perangkat baru → Pulihkan dari JSON.

Impor memvalidasi struktur file sebelum menerapkannya (lihat `readBackupFile()` di `src/lib/export.ts`), jadi file yang salah ditolak dengan pesan jelas, bukan merusak data yang ada.

### Batas kapasitas

localStorage dibatasi sekitar **5 MB** per origin. Satu transaksi memakan ± 150 byte, jadi puluhan ribu catatan masih aman — jauh di atas kebutuhan pemakaian pribadi bertahun-tahun. `persist()` sudah dibungkus `try/catch`, sehingga kuota penuh atau mode privat tidak membuat aplikasi mati; datanya hanya tidak bertahan.

Kalau suatu saat butuh lebih (misalnya menyimpan lampiran foto struk), tukar dua fungsi di `src/lib/store.ts` — `persist()` dan `hydrateStore()` — ke IndexedDB. Tidak ada satu pun komponen yang perlu ikut berubah, karena semuanya membaca lewat `useStore()`.

### Kalau nanti butuh multi-perangkat sungguhan

Lapisan penyimpanan terisolasi di dua fungsi yang sama. Menambahkan backend berarti mengubah keduanya menjadi panggilan jaringan, ditambah lapisan autentikasi. Itu perubahan arsitektur yang nyata — bukan sekadar menyalakan saklar — jadi pertimbangkan apakah Backup/Restore manual sudah cukup untuk kebutuhanmu sebelum menambah server, akun, dan biaya bulanan.

---

## 8b. Menambah metrik di kartu utama Beranda

Angka besar di kartu Beranda bisa diganti pengguna, dan pilihannya berasal dari
satu tabel di `src/lib/hero-metrics.ts`. Menambah pilihan cukup menambah satu
entri:

```ts
{
  id: "tersimpan",                      // tambahkan juga ke HeroMetric di types.ts
  label: "Total tersimpan",
  icon: PiggyBank,
  scope: "total",                       // "month" akan diberi sufiks "· AGU 26"
  hint: "Dana yang sudah diparkir di semua target tabungan.",
  value: (c) => c.saved,                // tambahkan field-nya ke HeroContext
  companions: [MASUK, KELUAR],
}
```

Satu aturan yang harus dijaga: **`companions` tidak boleh memuat angka yang sama
dengan `value`.** Kartu yang menampilkan nominal yang sama dua kali terbaca
seperti bug. Itu sebabnya pasangannya ditulis eksplisit per metrik, bukan
diturunkan otomatis.

Kalau angkanya belum tersedia di `HeroContext`, hitung di `src/app/page.tsx`
(sudah ada `useMemo` yang menghitung semuanya) lalu teruskan ke `BalanceHero`.
Jangan menulis rumus baru di `hero-metrics.ts` — file itu sengaja hanya membaca,
supaya seluruh perhitungan tetap terkumpul di `src/lib/stats.ts`.

Pemilihnya di Pengaturan → Tampilan membaca tabel yang sama, jadi tidak ada
tempat kedua yang perlu diperbarui.

---

## 9. Memasang untuk pengguna sungguhan (bukan demo)

Kalau template ini kamu serahkan ke klien atau pengguna akhir — bukan dipajang
sebagai demo — ada satu saklar yang **wajib** diubah, di `src/lib/config.ts`:

```ts
export const DEMO_DATA_ON_FIRST_RUN = false;
```

Alasannya bukan kosmetik. Dengan `true`, aplikasi mengisi 238 transaksi contoh
setiap kali menemukan penyimpanan kosong. Kalau penyimpanan browser pengguna
sempat terhapus, yang mereka lihat saat membuka aplikasi bukan halaman kosong,
melainkan **catatan keuangan asing menggantikan catatan mereka**. Secara teknis
itu bukan kehilangan data yang disebabkan aplikasi, tapi bagi penggunanya tidak
ada bedanya — dan kepercayaan tidak kembali setelah itu.

Saklar kedua di file yang sama mengatur pengingat backup:

```ts
export const BACKUP_REMINDER_AFTER = 20; // 0 untuk mematikan
```

### Yang sudah dikerjakan aplikasi untuk menjaga data

| Lapisan | Cara kerja |
|---|---|
| Penyimpanan permanen | `navigator.storage.persist()` dipanggil saat aplikasi hidup, supaya browser tidak membuang data ini saat memori perangkat menipis. Statusnya terlihat di Pengaturan → Keamanan Data |
| Urungkan | Setiap tindakan merusak (Hapus semua, Muat demo, Impor "Ganti semua", Pulihkan backup) menyimpan snapshot lebih dulu, satu tingkat |
| Pengingat backup | Menghitung transaksi yang tercatat sejak backup terakhir dan memperingatkan setelah ambang di atas |
| Data rusak | Kalau JSON tersimpan gagal dibaca, aplikasi **tidak menimpanya** — sisa datanya masih bisa diselamatkan manual dari penyimpanan browser |

Penyimpanan permanen paling mungkin dikabulkan browser kalau aplikasinya sudah
dipasang ke layar utama. Arahkan penggunamu untuk **Add to Home Screen** di
kunjungan pertama.

Yang tetap tidak bisa dicegah kode mana pun: pengguna menekan *Hapus data situs*
di pengaturan browser, atau berpindah HP. Untuk dua hal itu, backup berkala
adalah satu-satunya jawaban.

---

## 10. Sebelum rilis

- [ ] Setel `DEMO_DATA_ON_FIRST_RUN = false` di `src/lib/config.ts` kalau ini untuk pengguna sungguhan
- [ ] Ganti `--brand` dan warna turunannya, lalu jalankan `npm run icons`
- [ ] Ubah nama aplikasi di `src/app/layout.tsx` (metadata) dan `public/manifest.webmanifest`
- [ ] Ganti tulisan "Dompet" di `src/components/shell/Logo.tsx` dan `src/components/shell/Sidebar.tsx`
- [ ] Sesuaikan `background_color` dan `theme_color` di manifest agar cocok dengan `--bg`
- [ ] Naikkan konstanta `CACHE` di `public/sw.js` (mis. `dompet-v2`) supaya aset lama tersapu
- [ ] Perbarui paragraf lisensi di `README.md`
- [ ] Jalankan `npm run typecheck && npm run lint && npm run build`
- [ ] Uji di lebar 320px, 430px, 768px, dan 1440px — tidak boleh ada scroll horizontal
- [ ] Uji kedua tema dan mode "Sembunyikan nominal"
- [ ] Pasang ke Home Screen di HP untuk memastikan PWA-nya bersih
