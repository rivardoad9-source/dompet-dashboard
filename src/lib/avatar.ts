/**
 * Menyiapkan foto profil untuk disimpan di localStorage.
 *
 * Foto dari kamera HP berukuran 3–8 MB. Menyimpannya apa adanya sebagai data
 * URL akan langsung menghabiskan kuota localStorage yang cuma sekitar 5 MB —
 * dan yang hilang bukan cuma fotonya, tapi seluruh catatan keuangan pengguna,
 * karena semuanya berbagi kunci yang sama.
 *
 * Jadi hasil akhirnya selalu persegi 128 piksel, sekitar 2–8 KB. Bagian mana
 * dari foto yang dipakai ditentukan pengguna lewat geser dan zoom di
 * `AvatarCropSheet`, bukan ditebak — memotong wajah orang di tengah adalah
 * tebakan yang sering meleset pada foto potret.
 */

/** Sisi persegi hasil akhir, dalam piksel. */
export const AVATAR_SIZE = 128;

/** Kualitas JPEG. 0,82 sudah tidak terlihat bedanya pada ukuran sekecil ini. */
const QUALITY = 0.82;

/** Batas berkas masukan — menolak lebih awal daripada menggantung saat decode. */
const MAX_INPUT_BYTES = 12 * 1024 * 1024;

export const ZOOM_MIN = 1;
export const ZOOM_MAX = 4;

export type LoadResult =
  | { ok: true; image: HTMLImageElement; url: string }
  | { ok: false; error: string };

/**
 * Membaca berkas menjadi elemen gambar yang siap ditampilkan sekaligus digambar
 * ulang ke canvas. Pemanggil wajib memanggil `releaseImage` setelah selesai.
 */
export async function loadAvatarFile(file: File): Promise<LoadResult> {
  if (!file.type.startsWith("image/")) {
    return { ok: false, error: "File itu bukan gambar. Pilih JPG, PNG, atau WebP." };
  }
  if (file.size > MAX_INPUT_BYTES) {
    return { ok: false, error: "Gambarnya terlalu besar. Pilih yang di bawah 12 MB." };
  }

  const url = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("decode gagal"));
      img.src = url;
    });

    if (!image.naturalWidth || !image.naturalHeight) {
      URL.revokeObjectURL(url);
      return { ok: false, error: "Gambarnya tidak bisa dibaca. Coba file lain." };
    }
    return { ok: true, image, url };
  } catch {
    URL.revokeObjectURL(url);
    return { ok: false, error: "Gambarnya tidak bisa dibaca. Coba file lain." };
  }
}

export function releaseImage(url: string) {
  URL.revokeObjectURL(url);
}

export interface CropView {
  /** Sisi kotak pratinjau di layar, dalam piksel CSS. */
  viewport: number;
  zoom: number;
  /** Posisi sudut kiri-atas gambar relatif terhadap kotak pratinjau. */
  offsetX: number;
  offsetY: number;
}

/**
 * Skala terkecil yang masih menutupi seluruh kotak pratinjau.
 *
 * Semua perhitungan lain bertumpu pada angka ini, jadi zoom 1 selalu berarti
 * "pas menutupi" berapa pun rasio foto aslinya — dan celah kosong di pinggir
 * tidak pernah mungkin terjadi.
 */
export function baseScale(image: HTMLImageElement, viewport: number): number {
  return Math.max(viewport / image.naturalWidth, viewport / image.naturalHeight);
}

/** Menjaga gambar tetap menutupi kotak pratinjau setelah digeser atau di-zoom. */
export function clampOffset(image: HTMLImageElement, view: CropView): { x: number; y: number } {
  const eff = baseScale(image, view.viewport) * view.zoom;
  const minX = view.viewport - image.naturalWidth * eff;
  const minY = view.viewport - image.naturalHeight * eff;
  return {
    x: Math.min(0, Math.max(minX, view.offsetX)),
    y: Math.min(0, Math.max(minY, view.offsetY)),
  };
}

export interface RenderResult {
  dataUrl: string;
  bytes: number;
}

/** Menggambar bagian yang terlihat di kotak pratinjau menjadi PNG/JPEG 128px. */
export function renderAvatar(image: HTMLImageElement, view: CropView): RenderResult | null {
  const canvas = document.createElement("canvas");
  canvas.width = AVATAR_SIZE;
  canvas.height = AVATAR_SIZE;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  const eff = baseScale(image, view.viewport) * view.zoom;
  const { x, y } = clampOffset(image, view);

  // Kotak pratinjau dipetakan kembali ke koordinat gambar aslinya.
  const sx = -x / eff;
  const sy = -y / eff;
  const side = view.viewport / eff;

  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(image, sx, sy, side, side, 0, 0, AVATAR_SIZE, AVATAR_SIZE);

  const dataUrl = canvas.toDataURL("image/jpeg", QUALITY);
  const bytes = Math.round((dataUrl.length - dataUrl.indexOf(",") - 1) * 0.75);
  return { dataUrl, bytes };
}
