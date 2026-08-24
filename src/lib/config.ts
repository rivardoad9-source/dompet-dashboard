/**
 * Saklar perilaku aplikasi.
 *
 * Semua di sini adalah keputusan produk, bukan rahasia — nilainya ter-bundle
 * statis supaya tidak bisa salah konfigurasi saat deploy. Tidak ada
 * environment variable yang perlu diisi.
 */

/**
 * Isi aplikasi dengan 238 transaksi contoh saat pertama kali dibuka.
 *
 * Biarkan `true` kalau kamu memajang template ini sebagai demo — aplikasinya
 * langsung terlihat hidup tanpa pengunjung harus mengetik apa pun.
 *
 * **Setel `false` sebelum menyerahkannya ke pengguna sungguhan.** Kalau
 * penyimpanan browser mereka sempat terhapus, aplikasi akan menemukan data
 * kosong dan mengisinya lagi dengan data contoh — dan yang mereka lihat adalah
 * catatan keuangan asing menggantikan catatan mereka. Secara teknis itu bukan
 * kehilangan data yang disebabkan aplikasi, tapi bagi penggunanya tidak ada
 * bedanya, dan kepercayaan tidak kembali setelah itu.
 *
 * Dengan `false`, perangkat baru dibuka dalam keadaan kosong dan pengguna
 * mulai mencatat atau memulihkan backup-nya.
 */
export const DEMO_DATA_ON_FIRST_RUN = false;

/**
 * Ingatkan untuk mengambil backup setelah sekian transaksi baru sejak backup
 * terakhir. Setel 0 untuk mematikan pengingat.
 */
export const BACKUP_REMINDER_AFTER = 20;
