import type { ParsedSheet } from "./csv-import";

/**
 * Membaca file .xlsx dari aplikasi pencatat keuangan lain.
 *
 * Repo ini sudah punya penulis .xlsx ([xlsx.ts]) di atas penulis ZIP sendiri;
 * ini kebalikannya. Sebuah .xlsx tidak lain adalah arsip ZIP berisi beberapa
 * XML, jadi yang dibutuhkan cuma pembaca ZIP (inflate lewat
 * `DecompressionStream` bawaan browser) plus pembaca dua-tiga XML.
 *
 * Alasannya sama seperti di pdf-import: pustaka spreadsheet adalah salah satu
 * paket terberat yang ada, sementara yang kita perlukan hanya "ambil sel
 * mentah dari sheet pertama".
 *
 * Keluarannya `ParsedSheet` — bentuk yang sama dengan parser CSV — jadi wizard
 * koreksi kolom dan pratinjau terpakai apa adanya.
 */

export type XlsxFailure = "not-zip" | "no-sheet" | "empty" | "unsupported" | "corrupt";

export interface XlsxSuccess {
  ok: true;
  sheet: ParsedSheet;
  /** Nama sheet yang dibaca, untuk ditampilkan ke pengguna. */
  sheetName: string;
}

export interface XlsxError {
  ok: false;
  reason: XlsxFailure;
  message: string;
}

export type XlsxImportResult = XlsxSuccess | XlsxError;

const fail = (reason: XlsxFailure, message: string): XlsxError => ({ ok: false, reason, message });

/* ==========================================================================
   Pembaca ZIP
   ========================================================================== */

/**
 * Membaca isi arsip lewat central directory di ekor berkas.
 *
 * Central directory dipakai, bukan pemindaian local header berurutan, karena
 * itulah satu-satunya indeks yang dijamin benar oleh spesifikasi ZIP — penulis
 * yang memakai data descriptor menulis ukuran nol di local header.
 */
async function readZip(bytes: Uint8Array): Promise<Map<string, Uint8Array> | null> {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

  // End of central directory: cari mundur, komentar arsip maksimal 65535 byte.
  let eocd = -1;
  const floor = Math.max(0, bytes.length - 65_557);
  for (let i = bytes.length - 22; i >= floor; i--) {
    if (view.getUint32(i, true) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) return null;

  const count = view.getUint16(eocd + 10, true);
  let pointer = view.getUint32(eocd + 16, true);

  const decoder = new TextDecoder();
  const out = new Map<string, Uint8Array>();

  for (let n = 0; n < count; n++) {
    if (pointer + 46 > bytes.length) break;
    if (view.getUint32(pointer, true) !== 0x02014b50) break;

    const method = view.getUint16(pointer + 10, true);
    const compressedSize = view.getUint32(pointer + 20, true);
    const nameLength = view.getUint16(pointer + 28, true);
    const extraLength = view.getUint16(pointer + 30, true);
    const commentLength = view.getUint16(pointer + 32, true);
    const localOffset = view.getUint32(pointer + 42, true);

    const name = decoder.decode(bytes.subarray(pointer + 46, pointer + 46 + nameLength));
    pointer += 46 + nameLength + extraLength + commentLength;

    // Panjang nama & extra di local header bisa berbeda dari yang di central.
    if (localOffset + 30 > bytes.length) continue;
    if (view.getUint32(localOffset, true) !== 0x04034b50) continue;

    const localNameLength = view.getUint16(localOffset + 26, true);
    const localExtraLength = view.getUint16(localOffset + 28, true);
    const start = localOffset + 30 + localNameLength + localExtraLength;
    const data = bytes.subarray(start, start + compressedSize);

    if (method === 0) {
      out.set(name, data);
      continue;
    }
    if (method !== 8) continue; // hanya store & deflate yang dipakai .xlsx

    const inflated = await inflateRaw(data);
    if (inflated) out.set(name, inflated);
  }

  return out;
}

/** ZIP memakai deflate mentah, tanpa bungkus zlib. */
async function inflateRaw(bytes: Uint8Array): Promise<Uint8Array | null> {
  if (typeof DecompressionStream === "undefined") return null;
  try {
    const stream = new Blob([new Uint8Array(bytes)])
      .stream()
      .pipeThrough(new DecompressionStream("deflate-raw"));
    return new Uint8Array(await new Response(stream).arrayBuffer());
  } catch {
    return null;
  }
}

/* ==========================================================================
   XML
   ========================================================================== */

const ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
};

function unescapeXml(s: string): string {
  return s.replace(/&(#x?[0-9a-fA-F]+|\w+);/g, (whole, code: string) => {
    if (code[0] === "#") {
      const value =
        code[1] === "x" || code[1] === "X"
          ? parseInt(code.slice(2), 16)
          : parseInt(code.slice(1), 10);
      return Number.isFinite(value) ? String.fromCodePoint(value) : whole;
    }
    return ENTITIES[code] ?? whole;
  });
}

const utf8 = (bytes: Uint8Array | undefined): string =>
  bytes ? new TextDecoder().decode(bytes) : "";

/* ==========================================================================
   Bagian-bagian workbook
   ========================================================================== */

/** Tabel string bersama — sel teks di .xlsx menyimpan indeks ke sini. */
function parseSharedStrings(xml: string): string[] {
  if (!xml) return [];
  const out: string[] = [];

  for (const si of xml.match(/<si\b[\s\S]*?<\/si>|<si\b[^>]*\/>/g) ?? []) {
    // Teks kaya dipecah menjadi beberapa <r><t>…</t></r>; gabungkan semuanya.
    const parts = si.match(/<t\b[^>]*>([\s\S]*?)<\/t>/g) ?? [];
    out.push(
      parts
        .map((t) => unescapeXml(t.replace(/^<t\b[^>]*>/, "").replace(/<\/t>$/, "")))
        .join(""),
    );
  }
  return out;
}

/** Id format bawaan Excel yang berarti tanggal atau waktu. */
const BUILTIN_DATE_FORMATS = new Set([14, 15, 16, 17, 18, 19, 20, 21, 22, 45, 46, 47]);

/**
 * Menentukan gaya sel mana yang berisi tanggal.
 *
 * Excel menyimpan tanggal sebagai angka biasa; satu-satunya penanda bahwa
 * 46256 sebenarnya "23 Agustus 2026" adalah format tampilannya. Tanpa langkah
 * ini seluruh kolom tanggal masuk sebagai bilangan lima digit.
 */
function parseDateStyles(xml: string): Set<number> {
  const out = new Set<number>();
  if (!xml) return out;

  // Format kustom yang mengandung penanda hari/bulan/tahun.
  const custom = new Set<number>();
  for (const m of xml.matchAll(/<numFmt\b[^>]*numFmtId="(\d+)"[^>]*formatCode="([^"]*)"/g)) {
    const code = unescapeXml(m[2]);
    // Buang literal dalam kutip supaya teks seperti "Mei" tidak salah dianggap.
    const bare = code.replace(/"[^"]*"/g, "").replace(/\[[^\]]*\]/g, "");
    if (/[ymd]/i.test(bare)) custom.add(Number(m[1]));
  }

  const cellXfs = xml.match(/<cellXfs\b[\s\S]*?<\/cellXfs>/)?.[0] ?? "";
  const xfs = cellXfs.match(/<xf\b[^>]*\/>|<xf\b[^>]*>[\s\S]*?<\/xf>/g) ?? [];

  xfs.forEach((xf, index) => {
    const id = Number(xf.match(/numFmtId="(\d+)"/)?.[1] ?? NaN);
    if (Number.isFinite(id) && (BUILTIN_DATE_FORMATS.has(id) || custom.has(id))) out.add(index);
  });

  return out;
}

/** "A1" atau "BC12" menjadi indeks kolom berbasis nol. */
function columnIndex(ref: string): number {
  const letters = ref.match(/^[A-Z]+/)?.[0] ?? "A";
  let index = 0;
  for (const ch of letters) index = index * 26 + (ch.charCodeAt(0) - 64);
  return index - 1;
}

/**
 * Serial Excel menjadi `YYYY-MM-DD`.
 *
 * Basisnya 1899-12-30, bukan 1900-01-01, karena Excel mempertahankan bug
 * Lotus 1-2-3 yang menganggap 1900 tahun kabisat.
 */
function serialToIso(serial: number): string {
  const ms = Math.round(serial * 86_400_000) + Date.UTC(1899, 11, 30);
  const d = new Date(ms);
  if (Number.isNaN(d.getTime())) return String(serial);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(
    d.getUTCDate(),
  ).padStart(2, "0")}`;
}

/** Sheet XML menjadi larik baris berisi teks sel. */
function parseSheet(xml: string, shared: string[], dateStyles: Set<number>): string[][] {
  const rows: string[][] = [];

  for (const rowXml of xml.match(/<row\b[^>]*>[\s\S]*?<\/row>|<row\b[^>]*\/>/g) ?? []) {
    const cells: string[] = [];

    for (const cellXml of rowXml.match(/<c\b[^>]*>[\s\S]*?<\/c>|<c\b[^>]*\/>/g) ?? []) {
      const ref = cellXml.match(/\br="([A-Z]+\d+)"/)?.[1];
      const type = cellXml.match(/\bt="([^"]+)"/)?.[1] ?? "n";
      const style = Number(cellXml.match(/\bs="(\d+)"/)?.[1] ?? NaN);

      let text = "";

      if (type === "inlineStr") {
        const parts = cellXml.match(/<t\b[^>]*>([\s\S]*?)<\/t>/g) ?? [];
        text = parts
          .map((t) => unescapeXml(t.replace(/^<t\b[^>]*>/, "").replace(/<\/t>$/, "")))
          .join("");
      } else {
        const rawValue = cellXml.match(/<v\b[^>]*>([\s\S]*?)<\/v>/)?.[1] ?? "";
        const value = unescapeXml(rawValue);

        if (type === "s") {
          text = shared[Number(value)] ?? "";
        } else if (type === "b") {
          text = value === "1" ? "TRUE" : "FALSE";
        } else if (value && Number.isFinite(style) && dateStyles.has(style) && !Number.isNaN(Number(value))) {
          text = serialToIso(Number(value));
        } else {
          text = value;
        }
      }

      // Sel kosong tidak ditulis di XML — isi celahnya supaya kolom tetap lurus.
      const index = ref ? columnIndex(ref) : cells.length;
      while (cells.length < index) cells.push("");
      cells[index] = text.trim();
    }

    rows.push(cells);
  }

  return rows;
}

/** Sheet pertama menurut workbook.xml, dengan cadangan sheet1.xml. */
function findFirstSheet(files: Map<string, Uint8Array>): { path: string; name: string } | null {
  const workbook = utf8(files.get("xl/workbook.xml"));
  const rels = utf8(files.get("xl/_rels/workbook.xml.rels"));

  const first = workbook.match(/<sheet\b[^>]*\/>/)?.[0];
  if (first) {
    const name = unescapeXml(first.match(/name="([^"]*)"/)?.[1] ?? "Sheet1");
    const rid = first.match(/r:id="([^"]*)"/)?.[1];

    if (rid) {
      const rel = rels.match(new RegExp(`<Relationship\\b[^>]*Id="${rid}"[^>]*>`))?.[0];
      const target = rel?.match(/Target="([^"]*)"/)?.[1];
      if (target) {
        const path = target.startsWith("/")
          ? target.slice(1)
          : `xl/${target.replace(/^\.\//, "")}`;
        if (files.has(path)) return { path, name };
      }
    }

    if (files.has("xl/worksheets/sheet1.xml")) return { path: "xl/worksheets/sheet1.xml", name };
  }

  for (const path of files.keys()) {
    if (/^xl\/worksheets\/[^/]+\.xml$/.test(path)) return { path, name: "Sheet1" };
  }
  return null;
}

/* ==========================================================================
   Entri publik
   ========================================================================== */

export async function parseXlsx(source: ArrayBuffer): Promise<XlsxImportResult> {
  const bytes = new Uint8Array(source);

  // Semua .xlsx adalah ZIP, dan semua ZIP diawali "PK".
  if (bytes[0] !== 0x50 || bytes[1] !== 0x4b) {
    return fail(
      "not-zip",
      "File ini bukan .xlsx yang utuh. Kalau ekstensinya .xls (format lama), buka di Excel atau Google Sheets lalu simpan ulang sebagai .xlsx atau CSV.",
    );
  }

  if (typeof DecompressionStream === "undefined") {
    return fail(
      "unsupported",
      "Browser ini belum bisa membuka file Excel. Coba Chrome, Edge, atau Safari versi terbaru.",
    );
  }

  const files = await readZip(bytes);
  if (!files?.size) return fail("corrupt", "Isi file Excel tidak bisa dibaca.");

  const target = findFirstSheet(files);
  if (!target) return fail("no-sheet", "Tidak ada lembar kerja yang bisa dibaca di file ini.");

  const shared = parseSharedStrings(utf8(files.get("xl/sharedStrings.xml")));
  const dateStyles = parseDateStyles(utf8(files.get("xl/styles.xml")));
  const grid = parseSheet(utf8(files.get(target.path)), shared, dateStyles);

  // Baris judul = baris pertama yang benar-benar berisi sesuatu.
  const start = grid.findIndex((r) => r.some((c) => c.length > 0));
  if (start < 0) return fail("empty", "Lembar kerja pertama kosong.");

  const headers = grid[start];
  const rows = grid.slice(start + 1).filter((r) => r.some((c) => c.length > 0));

  if (!rows.length) {
    return fail("empty", "File ini hanya berisi baris judul, tanpa data transaksi.");
  }

  return {
    ok: true,
    sheet: { headers, rows, delimiter: "" },
    sheetName: target.name,
  };
}
