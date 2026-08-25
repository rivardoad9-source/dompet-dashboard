/**
 * Menyiapkan foto profil untuk disimpan di localStorage.
 *
 * Foto dari kamera HP berukuran 3–8 MB. Menyimpannya apa adanya sebagai data
 * URL akan langsung menghabiskan kuota localStorage yang cuma sekitar 5 MB —
 * dan yang hilang bukan cuma fotonya, tapi seluruh catatan keuangan pengguna,
 * karena semuanya berbagi kunci yang sama.
 *
 * Jadi gambarnya dipotong ke bentuk persegi lalu diperkecil ke 128 piksel
 * sebelum disimpan. Hasilnya sekitar 6–10 KB, dan itu ukuran tampilan
 * maksimalnya di aplikasi ini (avatar 36 piksel pada layar 3x).
 */

/** Sisi persegi hasil akhir, dalam piksel. */
const SIZE = 128;

/** Kualitas JPEG. 0,82 sudah tidak terlihat bedanya pada ukuran sekecil ini. */
const QUALITY = 0.82;

/** Batas berkas masukan — menolak lebih awal daripada menggantung saat decode. */
const MAX_INPUT_BYTES = 12 * 1024 * 1024;

export type AvatarResult =
  | { ok: true; dataUrl: string; bytes: number }
  | { ok: false; error: string };

export async function readAvatarFile(file: File): Promise<AvatarResult> {
  if (!file.type.startsWith("image/")) {
    return { ok: false, error: "File itu bukan gambar. Pilih JPG, PNG, atau WebP." };
  }
  if (file.size > MAX_INPUT_BYTES) {
    return { ok: false, error: "Gambarnya terlalu besar. Pilih yang di bawah 12 MB." };
  }

  let bitmap: ImageBitmap | HTMLImageElement;
  try {
    bitmap = await loadImage(file);
  } catch {
    return { ok: false, error: "Gambarnya tidak bisa dibaca. Coba file lain." };
  }

  const width = "width" in bitmap ? bitmap.width : 0;
  const height = "height" in bitmap ? bitmap.height : 0;
  if (!width || !height) return { ok: false, error: "Gambarnya tidak bisa dibaca." };

  const canvas = document.createElement("canvas");
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext("2d");
  if (!ctx) return { ok: false, error: "Browser ini tidak bisa memproses gambar." };

  // Potong bagian tengah menjadi persegi, baru diperkecil — supaya foto potret
  // tidak menjadi gepeng saat ditampilkan di lingkaran avatar.
  const side = Math.min(width, height);
  const sx = (width - side) / 2;
  const sy = (height - side) / 2;

  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bitmap as CanvasImageSource, sx, sy, side, side, 0, 0, SIZE, SIZE);
  if ("close" in bitmap) bitmap.close();

  const dataUrl = canvas.toDataURL("image/jpeg", QUALITY);
  // Perkiraan ukuran biner dari panjang base64.
  const bytes = Math.round((dataUrl.length - dataUrl.indexOf(",") - 1) * 0.75);

  return { ok: true, dataUrl, bytes };
}

/** `createImageBitmap` jauh lebih cepat; `<img>` jadi cadangan bila tak ada. */
async function loadImage(file: File): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === "function") {
    return createImageBitmap(file);
  }

  const url = URL.createObjectURL(file);
  try {
    return await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("decode gagal"));
      img.src = url;
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}
