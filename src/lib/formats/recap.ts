import { getCategory } from "../categories";
import { formatCompact, formatIDR, monthLabel, STATUS_META } from "../format";
import type { BudgetSummary, CategorySlice, MonthTotals } from "../stats";

/**
 * Kartu rekap bulanan sebagai gambar PNG, digambar langsung ke canvas.
 *
 * Sengaja bukan tangkapan layar. Tangkapan layar membawa serta navigasi,
 * tombol, dan potongan kartu lain yang tidak relevan, lalu ukurannya mengikuti
 * layar perangkat. Kartu ini dirancang khusus untuk dibagikan: rasio potret
 * 4:5 yang pas di feed dan status WhatsApp, angka besar yang terbaca di
 * thumbnail, dan tanpa satu pun elemen antarmuka.
 *
 * Warnanya dibaca dari CSS custom property yang sedang aktif, jadi gambar ini
 * otomatis mengikuti tema Noir atau Midnight — dan ikut berubah kalau pembeli
 * mengganti warna brand, tanpa menyentuh file ini.
 */

const W = 1080;
const H = 1350;

function cssVar(name: string, fallback: string): string {
  if (typeof document === "undefined") return fallback;
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value || fallback;
}

function fontStack(): string {
  if (typeof document === "undefined") return "sans-serif";
  return getComputedStyle(document.body).fontFamily || "sans-serif";
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

export interface RecapInput {
  monthKey: string;
  summary: BudgetSummary;
  totals: MonthTotals;
  breakdown: CategorySlice[];
  name: string;
}

export async function buildRecapImage(input: RecapInput): Promise<Blob> {
  // Tanpa ini, teks pertama kadang tergambar dengan font cadangan.
  if (typeof document !== "undefined" && document.fonts?.ready) {
    await document.fonts.ready;
  }

  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas tidak didukung di browser ini.");

  const font = fontStack();
  const bg = cssVar("--bg", "#000000");
  const surface = cssVar("--surface", "#121212");
  const ink = cssVar("--ink", "#f5f5f5");
  const inkMuted = cssVar("--ink-muted", "#a3a3a3");
  const inkFaint = cssVar("--ink-faint", "#8f8f8f");
  const line = cssVar("--line", "#333333");
  const brand = cssVar("--brand", "#c8f24e");
  const heroFrom = cssVar("--hero-from", "#1f1f1f");
  const heroTo = cssVar("--hero-to", "#070707");
  const heroInk = cssVar("--hero-ink", "#fafafa");
  const success = cssVar("--success", "#4ade80");
  const statusColor = cssVar(STATUS_META[input.summary.status].colorVar, brand);

  const text = (
    value: string,
    x: number,
    y: number,
    size: number,
    weight: number,
    color: string,
    align: CanvasTextAlign = "left",
  ) => {
    ctx.font = `${weight} ${size}px ${font}`;
    ctx.fillStyle = color;
    ctx.textAlign = align;
    ctx.textBaseline = "alphabetic";
    ctx.fillText(value, x, y);
  };

  /* ---- Latar ---- */
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  /* ---- Kepala bergradasi ---- */
  const grad = ctx.createLinearGradient(0, 0, W, 420);
  grad.addColorStop(0, heroFrom);
  grad.addColorStop(1, heroTo);
  ctx.fillStyle = grad;
  roundRect(ctx, 64, 64, W - 128, 356, 44);
  ctx.fill();

  text("REKAP BULANAN", 112, 148, 26, 800, heroInk);
  ctx.globalAlpha = 0.7;
  text(monthLabel(input.monthKey).toUpperCase(), 112, 190, 26, 600, heroInk);
  ctx.globalAlpha = 1;

  text("Total pengeluaran", 112, 268, 30, 600, heroInk);
  ctx.globalAlpha = 0.85;
  ctx.globalAlpha = 1;
  text(formatIDR(input.summary.spentAll), 112, 344, 76, 800, heroInk);

  ctx.globalAlpha = 0.75;
  text(
    `Masuk ${formatCompact(input.totals.income)}   ·   Sisa ${formatCompact(input.totals.net)}`,
    112,
    390,
    26,
    600,
    heroInk,
  );
  ctx.globalAlpha = 1;

  /* ---- Ring anggaran ---- */
  const cx = W / 2;
  const cy = 640;
  const radius = 130;
  const thickness = 34;

  ctx.lineCap = "butt";
  ctx.lineWidth = thickness;
  ctx.strokeStyle = cssVar("--surface-3", "#272727");
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.stroke();

  const denominator = Math.max(input.summary.limit, input.summary.spent);
  if (denominator > 0) {
    let start = -Math.PI / 2;
    for (const row of input.summary.rows.filter((r) => r.spent > 0)) {
      const sweep = (row.spent / denominator) * Math.PI * 2;
      ctx.strokeStyle = cssVar(row.colorVar, brand);
      ctx.beginPath();
      ctx.arc(cx, cy, radius, start, start + sweep - 0.02);
      ctx.stroke();
      start += sweep;
    }
  }

  const pct = Math.round(input.summary.pct);
  text("TERPAKAI", cx, cy - 26, 24, 700, inkMuted, "center");
  text(`${pct}%`, cx, cy + 44, 84, 800, ink, "center");
  text(STATUS_META[input.summary.status].label, cx, cy + 84, 26, 700, statusColor, "center");

  /* ---- Kategori teratas ---- */
  const ROW_H = 92;
  const CARD_H = 80;
  const top = input.breakdown.slice(0, 4);

  let y = 800;
  text("PENGELUARAN TERBESAR", 96, y, 24, 800, inkFaint);
  y += 46;

  for (const slice of top) {
    ctx.fillStyle = surface;
    roundRect(ctx, 80, y - 4, W - 160, CARD_H, 22);
    ctx.fill();
    ctx.strokeStyle = line;
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = cssVar(slice.colorVar, brand);
    roundRect(ctx, 104, y + 22, 14, 32, 7);
    ctx.fill();

    text(getCategory(slice.categoryId).label, 140, y + 38, 30, 700, ink);
    text(`${Math.round(slice.share)}% dari total`, 140, y + 65, 22, 500, inkFaint);
    text(formatIDR(slice.amount), W - 104, y + 50, 32, 800, ink, "right");

    y += ROW_H;
  }

  if (!top.length) {
    text("Belum ada pengeluaran bulan ini", W / 2, y + 40, 28, 600, inkFaint, "center");
    y += 90;
  }

  /* ---- Kaki ----
     Posisinya dihitung dari tempat baris terakhir benar-benar berhenti, lalu
     didorong ke dasar kanvas kalau masih ada ruang. Memakai angka tetap seperti
     `H - 132` membuat footer menimpa kartu keempat begitu daftarnya penuh. */
  const footerLine = Math.max(y + 24, H - 110);
  const footerText = footerLine + 52;

  ctx.strokeStyle = line;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(80, footerLine);
  ctx.lineTo(W - 80, footerLine);
  ctx.stroke();

  text(input.name ? `Dompet · ${input.name}` : "Dompet", 96, footerText, 28, 800, brand);
  text(
    `${input.summary.rows.reduce((s, r) => s + r.txCount, 0)} transaksi tercatat`,
    W - 96,
    footerText,
    24,
    600,
    input.totals.net >= 0 ? success : inkMuted,
    "right",
  );

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Gagal membuat gambar."))),
      "image/png",
    );
  });
}
