import { parseDate, type ParsedSheet } from "./csv-import";

/**
 * Membaca rekening koran / e-statement PDF menjadi baris transaksi.
 *
 * Tidak ada dependency PDF di sini — sengaja. Template ini menjual "lima
 * dependency runtime", dan pustaka PDF adalah salah satu paket terberat yang
 * ada. Yang kita butuhkan sebenarnya sempit: ambil teks beserta posisinya,
 * lalu kenali mana yang berbentuk tabel transaksi. Itu bisa dikerjakan dengan
 * `DecompressionStream` bawaan browser.
 *
 * Hasil akhirnya sengaja berupa `ParsedSheet` — bentuk yang sama persis dengan
 * keluaran parser CSV. Jadi seluruh alur setelahnya (tebak kolom, wizard
 * koreksi, pratinjau, penyimpulan arah uang) terpakai apa adanya, dan pengguna
 * tetap melihat serta bisa membetulkan tebakan sebelum apa pun tersimpan.
 *
 * Yang TIDAK didukung, dan dilaporkan terang-terangan ke pengguna:
 * - PDF hasil scan/foto (tidak ada lapisan teks — butuh OCR)
 * - PDF terkunci password (harus dibuka dulu di aplikasi lain)
 */

/* ==========================================================================
   Hasil
   ========================================================================== */

export type PdfFailure = "encrypted" | "scanned" | "no-rows" | "unsupported" | "corrupt";

export interface PdfSuccess {
  ok: true;
  sheet: ParsedSheet;
  /** Jumlah halaman yang berisi teks. */
  pages: number;
  /** Kolom saldo berjalan terdeteksi — pengguna perlu tahu agar tidak salah petakan. */
  hasBalance: boolean;
  /** Tahun diambil dari periode dokumen karena tanggal barisnya ditulis tanpa tahun. */
  yearFilled: boolean;
}

export interface PdfError {
  ok: false;
  reason: PdfFailure;
  message: string;
}

export type PdfImportResult = PdfSuccess | PdfError;

const fail = (reason: PdfFailure, message: string): PdfError => ({ ok: false, reason, message });

/* ==========================================================================
   Byte & string
   ========================================================================== */

/**
 * Byte menjadi karakter satu lawan satu (0x41 menjadi "A").
 *
 * Sengaja tidak memakai TextDecoder: kita butuh kode karakter yang PERSIS sama
 * dengan nilai byte-nya, karena font PDF memetakan kode byte ke huruf lewat
 * tabel sendiri. windows-1252 akan menggeser rentang 0x80–0x9F dan merusak itu.
 */
function bytesToLatin1(bytes: Uint8Array): string {
  let out = "";
  const CHUNK = 0x8000; // hindari batas jumlah argumen String.fromCharCode
  for (let i = 0; i < bytes.length; i += CHUNK) {
    out += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return out;
}

/** Inflate stream FlateDecode memakai API bawaan browser. */
async function inflate(bytes: Uint8Array): Promise<Uint8Array | null> {
  if (typeof DecompressionStream === "undefined") return null;

  // Stream PDF umumnya berbungkus zlib (byte pertama 0x78), tapi ada penulis
  // PDF yang mengeluarkan deflate mentah. Coba yang paling mungkin lebih dulu.
  const formats: CompressionFormat[] =
    bytes[0] === 0x78 ? ["deflate", "deflate-raw"] : ["deflate-raw", "deflate"];

  for (const format of formats) {
    try {
      const stream = new Blob([new Uint8Array(bytes)])
        .stream()
        .pipeThrough(new DecompressionStream(format));
      const buf = await new Response(stream).arrayBuffer();
      if (buf.byteLength) return new Uint8Array(buf);
    } catch {
      // Format salah — coba yang berikutnya.
    }
  }
  return null;
}

/* ==========================================================================
   Struktur PDF
   ========================================================================== */

interface RawStream {
  /** Kamus di depan kata `stream`, untuk membaca /Filter dan /Type. */
  dict: string;
  bytes: Uint8Array;
  /** Nomor objek induk, untuk mencocokkan font dengan tabel ToUnicode-nya. */
  objNum: number;
}

/**
 * Mengumpulkan seluruh blok `stream … endstream` beserta kamus di depannya.
 *
 * Ini sengaja memindai berkas secara linear alih-alih menelusuri tabel xref.
 * Tabel xref sering rusak atau bertingkat, sementara yang kita perlukan cuma
 * "semua stream yang isinya teks" — dan itu tetap benar meski xref-nya kacau.
 * Lebih tahan banting untuk berkas keluaran mesin cetak bank.
 */
function collectStreams(raw: string, bytes: Uint8Array): RawStream[] {
  const out: RawStream[] = [];
  const re = /\bstream\r\n|\bstream\n|\bstream\r/g;
  let m: RegExpExecArray | null;

  while ((m = re.exec(raw))) {
    const dataStart = m.index + m[0].length;

    // Kamus objek ini: dari kata `obj` terakhir sebelum kata `stream`.
    const objStart = raw.lastIndexOf(" obj", m.index);
    const dict = objStart >= 0 ? raw.slice(objStart, m.index) : "";

    const header = raw.slice(Math.max(0, objStart - 24), objStart);
    const objNum = Number(header.match(/(\d+)\s+\d+\s*$/)?.[1] ?? -1);

    // /Length lebih akurat, tapi sering berupa rujukan tidak langsung —
    // dalam kasus itu jatuh kembali ke pencarian `endstream`.
    const declared = Number(dict.match(/\/Length\s+(\d+)(?!\s+\d+\s+R)/)?.[1] ?? NaN);
    let dataEnd: number;

    if (
      Number.isFinite(declared) &&
      declared > 0 &&
      raw.startsWith("endstream", dataStart + declared)
    ) {
      dataEnd = dataStart + declared;
    } else {
      const found = raw.indexOf("endstream", dataStart);
      if (found < 0) continue;
      dataEnd = found;
      // Buang EOL yang dipakai sebagai pemisah sebelum `endstream`.
      while (dataEnd > dataStart && (raw[dataEnd - 1] === "\n" || raw[dataEnd - 1] === "\r")) {
        dataEnd--;
      }
    }

    out.push({ dict, objNum, bytes: bytes.subarray(dataStart, dataEnd) });
    re.lastIndex = dataEnd;
  }

  return out;
}

/** Isi stream setelah dekompresi, atau null kalau filternya tidak kita dukung. */
async function decodeStream(s: RawStream): Promise<string | null> {
  const filter = s.dict.match(/\/Filter\s*(\/\w+|\[[^\]]*\])/)?.[1] ?? "";

  if (!filter) return bytesToLatin1(s.bytes);
  if (/FlateDecode/.test(filter)) {
    const out = await inflate(s.bytes);
    return out ? bytesToLatin1(out) : null;
  }
  // DCTDecode (JPEG), CCITTFaxDecode, dan kawan-kawan adalah gambar.
  return null;
}

/* ==========================================================================
   Tabel ToUnicode
   ========================================================================== */

interface CMap {
  map: Map<number, string>;
  twoByte: boolean;
}

/** Menerjemahkan rangkaian hex UTF-16BE menjadi karakter sungguhan. */
function hexToString(hex: string): string {
  const clean = hex.replace(/[^0-9a-fA-F]/g, "");
  let out = "";
  for (let i = 0; i + 4 <= clean.length; i += 4) {
    const code = parseInt(clean.slice(i, i + 4), 16);
    if (Number.isFinite(code)) out += String.fromCharCode(code);
  }
  return out;
}

/**
 * Membaca tabel /ToUnicode.
 *
 * Font di PDF sering di-subset: byte 0x03 bisa berarti huruf "a". Tanpa tabel
 * ini teksnya keluar sebagai sampah, dan justru cara itulah yang dipakai banyak
 * mesin cetak bank. Ada dua bentuk: bfchar (satu-satu) dan bfrange (rentang).
 */
function parseCMap(content: string): CMap {
  const map = new Map<number, string>();
  let twoByte = false;

  for (const block of content.match(/beginbfchar([\s\S]*?)endbfchar/g) ?? []) {
    const re = /<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]+)>/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(block))) {
      if (m[1].length > 2) twoByte = true;
      map.set(parseInt(m[1], 16), hexToString(m[2]));
    }
  }

  for (const block of content.match(/beginbfrange([\s\S]*?)endbfrange/g) ?? []) {
    // <awal> <akhir> <tujuanAwal> — rentang berurutan
    const seq = /<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]+)>/g;
    let m: RegExpExecArray | null;
    while ((m = seq.exec(block))) {
      if (m[1].length > 2) twoByte = true;
      const lo = parseInt(m[1], 16);
      const hi = parseInt(m[2], 16);
      const base = parseInt(m[3], 16);
      // Batasi agar berkas rusak tidak membekukan tab.
      for (let c = lo; c <= hi && c - lo < 0x10000; c++) {
        map.set(c, String.fromCharCode(base + (c - lo)));
      }
    }

    // <awal> <akhir> [ <d1> <d2> … ] — tiap kode punya tujuan sendiri
    const arr = /<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]+)>\s*\[([\s\S]*?)\]/g;
    while ((m = arr.exec(block))) {
      if (m[1].length > 2) twoByte = true;
      const lo = parseInt(m[1], 16);
      const items = m[3].match(/<([0-9a-fA-F]*)>/g) ?? [];
      items.forEach((item, i) => map.set(lo + i, hexToString(item)));
    }
  }

  return { map, twoByte };
}

/**
 * Memetakan nama sumber daya font (/F1) ke tabel ToUnicode-nya.
 *
 * Catatan jujur: pemetaan ini global, bukan per halaman. Kalau satu berkas
 * memakai /F1 untuk font berbeda di halaman berbeda, yang pertama menang.
 * Rekening koran praktis selalu memakai satu set font untuk seluruh halaman,
 * jadi ini pertukaran yang sepadan dibanding menelusuri page tree penuh.
 */
async function buildFontMaps(raw: string, streams: RawStream[]): Promise<Map<string, CMap>> {
  // Nomor objek font menjadi nomor objek stream ToUnicode-nya.
  const fontToUni = new Map<number, number>();
  const objRe = /(\d+)\s+\d+\s+obj([\s\S]*?)(?:stream|endobj)/g;
  let m: RegExpExecArray | null;

  while ((m = objRe.exec(raw))) {
    const uni = m[2].match(/\/ToUnicode\s+(\d+)\s+\d+\s+R/);
    if (uni) fontToUni.set(Number(m[1]), Number(uni[1]));
  }

  // Nama sumber daya menjadi nomor objek font, dari kamus /Font << /F1 5 0 R >>.
  const nameToFont = new Map<string, number>();
  for (const dict of raw.match(/\/Font\s*<<([\s\S]*?)>>/g) ?? []) {
    const re = /\/([^\s/<>[\]()]+)\s+(\d+)\s+\d+\s+R/g;
    let f: RegExpExecArray | null;
    while ((f = re.exec(dict))) {
      if (!nameToFont.has(f[1])) nameToFont.set(f[1], Number(f[2]));
    }
  }

  const byObj = new Map<number, RawStream>();
  for (const s of streams) if (s.objNum >= 0) byObj.set(s.objNum, s);

  const cmaps = new Map<number, CMap>();
  const out = new Map<string, CMap>();

  for (const [name, fontObj] of nameToFont) {
    const uniObj = fontToUni.get(fontObj);
    if (uniObj === undefined) continue;

    let cmap = cmaps.get(uniObj);
    if (!cmap) {
      const stream = byObj.get(uniObj);
      if (!stream) continue;
      const content = await decodeStream(stream);
      if (!content) continue;
      cmap = parseCMap(content);
      cmaps.set(uniObj, cmap);
    }
    if (cmap.map.size) out.set(name, cmap);
  }

  return out;
}

/* ==========================================================================
   Ekstraksi teks berposisi
   ========================================================================== */

interface TextItem {
  x: number;
  y: number;
  text: string;
  size: number;
}

type Matrix = [number, number, number, number, number, number];

const IDENTITY: Matrix = [1, 0, 0, 1, 0, 0];

function mul(a: Matrix, b: Matrix): Matrix {
  return [
    a[0] * b[0] + a[1] * b[2],
    a[0] * b[1] + a[1] * b[3],
    a[2] * b[0] + a[3] * b[2],
    a[2] * b[1] + a[3] * b[3],
    a[4] * b[0] + a[5] * b[2] + b[4],
    a[4] * b[1] + a[5] * b[3] + b[5],
  ];
}

const ESCAPES: Record<string, string> = {
  n: "\n",
  r: "\r",
  t: "\t",
  b: "\b",
  f: "\f",
};

/** Membaca string literal `(…)` beserta escape-nya, mulai tepat setelah kurung buka. */
function readLiteral(s: string, start: number): { text: string; end: number } {
  let out = "";
  let depth = 1;
  let i = start;

  while (i < s.length) {
    const ch = s[i];

    if (ch === "\\") {
      const next = s[i + 1] ?? "";
      if (next in ESCAPES) {
        out += ESCAPES[next];
        i += 2;
      } else if (next >= "0" && next <= "7") {
        const oct = s.slice(i + 1, i + 4).match(/^[0-7]{1,3}/)?.[0] ?? "0";
        out += String.fromCharCode(parseInt(oct, 8));
        i += 1 + oct.length;
      } else if (next === "\n" || next === "\r") {
        i += next === "\r" && s[i + 2] === "\n" ? 3 : 2; // sambungan baris
      } else {
        out += next;
        i += 2;
      }
      continue;
    }

    if (ch === "(") depth++;
    if (ch === ")") {
      depth--;
      if (depth === 0) return { text: out, end: i + 1 };
    }
    out += ch;
    i++;
  }

  return { text: out, end: i };
}

/** Kode byte menjadi teks, lewat tabel font kalau font itu punya. */
function decodeShown(raw: string, cmap: CMap | null): string {
  if (!cmap) return raw;

  let out = "";
  const step = cmap.twoByte ? 2 : 1;
  for (let i = 0; i < raw.length; i += step) {
    const code =
      step === 2 ? (raw.charCodeAt(i) << 8) | (raw.charCodeAt(i + 1) || 0) : raw.charCodeAt(i);
    out += cmap.map.get(code) ?? (step === 1 ? raw[i] : "");
  }
  return out;
}

const STR = " str:";
const NAME = " name:";

/**
 * Menjalankan operator teks di satu content stream dan mencatat posisi tiap
 * potongan teks. Operator `cm` sengaja diabaikan — rekening koran tidak
 * menskala halaman, dan mendukungnya menuntut penelusuran graphics state penuh.
 */
function extractItems(content: string, fonts: Map<string, CMap>): TextItem[] {
  const items: TextItem[] = [];
  const operands: Array<number | string> = [];

  let tm: Matrix = [...IDENTITY];
  let tlm: Matrix = [...IDENTITY];
  let leading = 0;
  let fontSize = 10;
  let cmap: CMap | null = null;

  const nums = (n: number): number[] =>
    operands.slice(-n).map((v) => (typeof v === "number" ? v : 0));

  const show = (text: string) => {
    if (!text) return;
    const scale = Math.hypot(tm[0], tm[1]) || 1;
    items.push({ x: tm[4], y: tm[5], text, size: fontSize * scale });
  };

  let i = 0;
  while (i < content.length) {
    const ch = content[i];

    if (ch === "(") {
      const { text, end } = readLiteral(content, i + 1);
      operands.push(STR + text);
      i = end;
      continue;
    }

    if (ch === "<" && content[i + 1] !== "<") {
      const close = content.indexOf(">", i);
      if (close < 0) break;
      const hex = content.slice(i + 1, close).replace(/[^0-9a-fA-F]/g, "");
      let text = "";
      for (let h = 0; h < hex.length; h += 2) {
        text += String.fromCharCode(parseInt(hex.slice(h, h + 2).padEnd(2, "0"), 16));
      }
      operands.push(STR + text);
      i = close + 1;
      continue;
    }

    if (ch === "/") {
      const name = content.slice(i + 1).match(/^[^\s/<>[\]()]+/)?.[0] ?? "";
      operands.push(NAME + name);
      i += 1 + name.length;
      continue;
    }

    if (/[-+.\d]/.test(ch)) {
      const num = content.slice(i).match(/^[-+]?[\d.]+/)?.[0] ?? "";
      operands.push(Number(num) || 0);
      i += num.length || 1;
      continue;
    }

    if (ch === "[" || ch === "]") {
      operands.push(ch);
      i++;
      continue;
    }

    if (/[A-Za-z'"*]/.test(ch)) {
      const op = content.slice(i).match(/^[A-Za-z*'"]+\d?/)?.[0] ?? ch;
      i += op.length;

      switch (op) {
        case "BT":
          tm = [...IDENTITY];
          tlm = [...IDENTITY];
          break;

        case "Tf": {
          const size = operands[operands.length - 1];
          if (typeof size === "number") fontSize = size;
          const nameOp = operands[operands.length - 2];
          const name =
            typeof nameOp === "string" && nameOp.startsWith(NAME) ? nameOp.slice(NAME.length) : "";
          cmap = fonts.get(name) ?? null;
          break;
        }

        case "TL":
          leading = nums(1)[0];
          break;

        case "Td": {
          const [tx, ty] = nums(2);
          tlm = mul([1, 0, 0, 1, tx, ty], tlm);
          tm = [...tlm];
          break;
        }

        case "TD": {
          const [tx, ty] = nums(2);
          leading = -ty;
          tlm = mul([1, 0, 0, 1, tx, ty], tlm);
          tm = [...tlm];
          break;
        }

        case "Tm": {
          const v = nums(6);
          tlm = [v[0], v[1], v[2], v[3], v[4], v[5]];
          tm = [...tlm];
          break;
        }

        case "T*":
          tlm = mul([1, 0, 0, 1, 0, -leading], tlm);
          tm = [...tlm];
          break;

        case "Tj":
        case "'":
        case '"': {
          if (op !== "Tj") {
            tlm = mul([1, 0, 0, 1, 0, -leading], tlm);
            tm = [...tlm];
          }
          const last = operands[operands.length - 1];
          if (typeof last === "string" && last.startsWith(STR)) {
            show(decodeShown(last.slice(STR.length), cmap));
          }
          break;
        }

        case "TJ": {
          // [ (Hal) -250 (o) ] — angkanya kerning; yang besar berarti spasi.
          const open = operands.lastIndexOf("[");
          let text = "";
          for (const part of operands.slice(open + 1)) {
            if (typeof part === "number") {
              if (part < -120) text += " ";
            } else if (typeof part === "string" && part.startsWith(STR)) {
              text += decodeShown(part.slice(STR.length), cmap);
            }
          }
          show(text);
          break;
        }
      }

      operands.length = 0;
      continue;
    }

    i++;
  }

  return items;
}

/* ==========================================================================
   Perakitan baris & sel
   ========================================================================== */

interface Cell {
  x: number;
  text: string;
}

/**
 * Menggabungkan potongan teks menjadi baris, lalu memecah tiap baris menjadi
 * sel tabel berdasarkan jarak antar potongan.
 *
 * Lebar huruf tidak kita ketahui tanpa membaca metrik font, jadi ditaksir dari
 * panjang teks dikali ukuran font. Cukup untuk membedakan "jeda antar kolom"
 * dari "spasi antar kata", dan itu satu-satunya keputusan yang perlu diambil.
 */
function assembleLines(items: TextItem[]): Cell[][] {
  if (!items.length) return [];

  const sorted = [...items].sort((a, b) => b.y - a.y || a.x - b.x);
  const lines: TextItem[][] = [];
  let current: TextItem[] = [];
  let baseline = sorted[0].y;

  for (const item of sorted) {
    const tolerance = Math.max(2, item.size * 0.35);
    if (Math.abs(item.y - baseline) > tolerance) {
      if (current.length) lines.push(current);
      current = [];
      baseline = item.y;
    }
    current.push(item);
  }
  if (current.length) lines.push(current);

  return lines
    .map((line) => {
      const ordered = [...line].sort((a, b) => a.x - b.x);
      const cells: Cell[] = [];
      let cell: Cell | null = null;
      let cursor = 0;

      for (const item of ordered) {
        const width = item.text.length * item.size * 0.5;
        const gap = item.x - cursor;

        if (!cell || gap > item.size * 0.9) {
          if (cell) cells.push(cell);
          cell = { x: item.x, text: item.text };
        } else {
          cell.text += gap > item.size * 0.18 ? " " + item.text : item.text;
        }
        cursor = item.x + width;
      }
      if (cell) cells.push(cell);

      return cells
        .map((c) => ({ x: c.x, text: c.text.replace(/\s+/g, " ").trim() }))
        .filter((c) => c.text.length > 0);
    })
    .filter((line) => line.length > 0);
}

/* ==========================================================================
   Mengenali baris transaksi
   ========================================================================== */

/**
 * Nominal harus punya pemisah ribuan atau dua digit desimal.
 *
 * Ini yang memisahkan "1.250.000" dari nomor referensi "0812345678" — dan
 * nomor referensi selalu ada di rekening koran.
 */
const AMOUNT_RE =
  /^\(?\s*(?:Rp\.?\s*)?[-+]?\s*(?:\d{1,3}(?:[.,]\d{3})+(?:[.,]\d{1,2})?|\d{3,}[.,]\d{2})\s*\)?\s*(?:(?:DB|CR|DR|K|D)\b\.?)?$/i;

/** Tanggal di awal baris; tahun boleh tidak ada — rekening koran sering begitu. */
const DATE_RE =
  /^\d{1,2}[-/.]\d{1,2}(?:[-/.]\d{2,4})?$|^\d{4}[-/.]\d{1,2}[-/.]\d{1,2}$|^\d{1,2}\s+[A-Za-z]{3,9}\.?(?:\s+\d{2,4})?$/;

const SUFFIX_RE = /(DB|DR|CR|K|D)\b\.?$/i;

const HEADER_WORDS = {
  debit: ["debit", "debet", "keluar", "pengeluaran", "withdrawal", "penarikan"],
  credit: ["kredit", "credit", "masuk", "pemasukan", "deposit", "setoran"],
  balance: ["saldo", "balance"],
  amount: ["mutasi", "jumlah", "nominal", "amount", "nilai"],
};

type BandRole = "debit" | "credit" | "balance" | "amount";

interface Band {
  x: number;
  role: BandRole;
  hits: number;
}

function isAmount(text: string): boolean {
  return AMOUNT_RE.test(text);
}

function looksLikeDate(text: string): boolean {
  if (!DATE_RE.test(text)) return false;
  // Saring "12.500" yang lolos pola DD.MM — itu nominal, bukan tanggal.
  if (isAmount(text)) return false;
  return parseDate(text, true) !== null || /^\d{1,2}[-/.]\d{1,2}$/.test(text);
}

/** Tahun dari baris periode, untuk melengkapi tanggal yang ditulis tanpa tahun. */
function documentYear(lines: Cell[][]): number | null {
  const text = lines.map((l) => l.map((c) => c.text).join(" ")).join("\n");
  const near = text.match(/(?:periode|period|tanggal|statement|bulan)[^\n]{0,60}?(20\d{2})/i);
  if (near) return Number(near[1]);

  const years = text.match(/\b20\d{2}\b/g);
  if (!years?.length) return null;

  // Tahun yang paling sering muncul — lebih tahan terhadap angka nyasar.
  const tally = new Map<string, number>();
  for (const y of years) tally.set(y, (tally.get(y) ?? 0) + 1);
  return Number([...tally.entries()].sort((a, b) => b[1] - a[1])[0][0]);
}

/**
 * Menentukan arti tiap kolom nominal.
 *
 * Prioritas pertama adalah judul kolom di PDF itu sendiri — kalau ada tulisan
 * "Debit" dan "Kredit", posisinya jauh lebih dipercaya daripada tebakan.
 * Tanpa judul, kolom nominal paling kanan yang terisi di hampir semua baris
 * dianggap saldo berjalan. Ini jebakan paling berbahaya di rekening koran:
 * mengimpor kolom saldo sebagai nominal menghasilkan catatan yang kacau total.
 */
function resolveBands(lines: Cell[][], rows: Cell[][]): Band[] {
  const positions: number[] = [];
  for (const row of rows) {
    for (const cell of row) if (isAmount(cell.text)) positions.push(cell.x);
  }
  if (!positions.length) return [];

  // Kelompokkan posisi x yang berdekatan menjadi satu kolom.
  positions.sort((a, b) => a - b);
  const bands: Band[] = [];
  for (const x of positions) {
    const last = bands[bands.length - 1];
    if (last && x - last.x < 12) {
      last.x = (last.x * last.hits + x) / (last.hits + 1);
      last.hits++;
    } else {
      bands.push({ x, role: "amount", hits: 1 });
    }
  }

  // Judul kolom, kalau dokumennya menuliskannya.
  const labels: Array<{ x: number; role: BandRole }> = [];
  for (const line of lines) {
    for (const cell of line) {
      const t = cell.text.toLowerCase();
      for (const [role, words] of Object.entries(HEADER_WORDS) as Array<[BandRole, string[]]>) {
        if (words.some((w) => t === w || t.startsWith(w + " ") || t.endsWith(" " + w))) {
          labels.push({ x: cell.x, role });
        }
      }
    }
  }

  if (labels.length) {
    for (const band of bands) {
      let best: { x: number; role: BandRole } | null = null;
      let bestDist = Infinity;
      for (const label of labels) {
        const dist = Math.abs(label.x - band.x);
        if (dist < bestDist) {
          bestDist = dist;
          best = label;
        }
      }
      // Judul harus benar-benar sejajar dengan kolomnya.
      if (best && bestDist < 60) band.role = best.role;
    }
    if (bands.some((b) => b.role !== "amount")) return bands;
  }

  // Tanpa judul: kolom paling kanan yang nyaris selalu terisi adalah saldo.
  if (bands.length >= 2) {
    const rightmost = bands[bands.length - 1];
    if (rightmost.hits >= rows.length * 0.6) rightmost.role = "balance";

    const rest = bands.filter((b) => b.role !== "balance");
    if (rest.length === 2) {
      rest[0].role = "debit";
      rest[1].role = "credit";
    }
  }

  return bands;
}

/* ==========================================================================
   Entri publik
   ========================================================================== */

/**
 * Judul kolom sintetis.
 *
 * Kata-katanya dipilih supaya `guessMapping` di csv-import mengenalinya tanpa
 * perlu aturan khusus: "Tanggal" menjadi tanggal, "Keterangan" menjadi catatan,
 * "Nominal Masuk" menjadi kolom pemasukan terpisah. "Saldo" sengaja tidak cocok
 * dengan petunjuk mana pun, jadi tidak akan pernah terpetakan otomatis — tapi
 * tetap terlihat di wizard supaya pengguna paham kolom itu ada dan diabaikan.
 */
const HEADERS = ["Tanggal", "Keterangan", "Nominal", "Nominal Masuk", "Tipe", "Saldo"];

export async function parsePdfStatement(source: ArrayBuffer): Promise<PdfImportResult> {
  const bytes = new Uint8Array(source);
  const raw = bytesToLatin1(bytes);

  if (!raw.slice(0, 1024).includes("%PDF-")) {
    return fail("corrupt", "File ini sepertinya bukan PDF yang utuh.");
  }

  if (/\/Encrypt\s+\d+\s+\d+\s+R/.test(raw)) {
    return fail(
      "encrypted",
      "PDF ini terkunci password. Buka dulu di pembaca PDF, simpan ulang tanpa password, lalu impor lagi.",
    );
  }

  if (typeof DecompressionStream === "undefined") {
    return fail(
      "unsupported",
      "Browser ini belum bisa membaca isi PDF. Coba Chrome, Edge, atau Safari versi terbaru.",
    );
  }

  const streams = collectStreams(raw, bytes);
  if (!streams.length) return fail("corrupt", "Isi PDF tidak bisa dibaca.");

  const fonts = await buildFontMaps(raw, streams);

  // Ambil content stream saja: yang isinya operator teks, bukan font atau gambar.
  const lines: Cell[][] = [];
  let pages = 0;

  for (const stream of streams) {
    if (/\/Type\s*\/(Font|XObject|Metadata)/.test(stream.dict)) continue;

    const content = await decodeStream(stream);
    if (!content || !content.includes("BT") || !/\bT[Jj]\b/.test(content)) continue;

    const items = extractItems(content, fonts);
    if (!items.length) continue;

    pages++;
    lines.push(...assembleLines(items));
  }

  if (!lines.length) {
    return fail(
      "scanned",
      "PDF ini tidak punya lapisan teks — kemungkinan hasil scan atau foto. Impor otomatis butuh PDF asli dari bank atau aplikasimu.",
    );
  }

  // Baris transaksi = diawali tanggal dan memuat minimal satu nominal.
  const rows = lines.filter(
    (line) => line.length >= 2 && looksLikeDate(line[0].text) && line.some((c) => isAmount(c.text)),
  );

  if (!rows.length) {
    return fail(
      "no-rows",
      "Teksnya terbaca, tapi tidak ada baris berpola tanggal + nominal. Kalau ini bukan rekening koran, ekspor CSV dari aplikasi asalnya akan jauh lebih akurat.",
    );
  }

  const bands = resolveBands(lines, rows);
  const year = documentYear(lines);
  let yearFilled = false;

  const sheetRows: string[][] = [];

  for (const row of rows) {
    let date = row[0].text;

    // Lengkapi "24/08" dengan tahun periode dokumen.
    if (/^\d{1,2}[-/.]\d{1,2}$/.test(date)) {
      if (!year) continue;
      date = `${date.replace(/[-.]/g, "/")}/${year}`;
      yearFilled = true;
    } else if (/^\d{1,2}\s+[A-Za-z]{3,9}\.?$/.test(date)) {
      if (!year) continue;
      date = `${date} ${year}`;
      yearFilled = true;
    }

    let debit = "";
    let credit = "";
    let plain = "";
    let balance = "";
    let type = "";
    const noteParts: string[] = [];

    for (let i = 1; i < row.length; i++) {
      const cell = row[i];

      if (!isAmount(cell.text)) {
        noteParts.push(cell.text);
        continue;
      }

      // Sufiks DB/CR pada gaya rekening koran Indonesia.
      const suffix = cell.text.match(SUFFIX_RE)?.[1]?.toUpperCase();
      if (suffix) type = suffix === "CR" || suffix === "K" ? "Kredit" : "Debit";

      const value = cell.text.replace(SUFFIX_RE, "").trim();

      // Cocokkan ke kolom terdekat hasil analisis judul/posisi.
      let role: BandRole = "amount";
      let bestDist = Infinity;
      for (const band of bands) {
        const dist = Math.abs(band.x - cell.x);
        if (dist < bestDist) {
          bestDist = dist;
          role = band.role;
        }
      }

      if (role === "balance") balance ||= value;
      else if (role === "debit") debit ||= value;
      else if (role === "credit") credit ||= value;
      else plain ||= value;
    }

    // Kolom debit/kredit terpisah lebih dipercaya daripada nominal tunggal.
    const amount = debit || plain;
    if (!amount && !credit) continue;

    sheetRows.push([date, noteParts.join(" ").slice(0, 120), amount, credit, type, balance]);
  }

  if (!sheetRows.length) {
    return fail(
      "no-rows",
      "Baris transaksi terdeteksi, tapi tanggalnya tidak lengkap dan tahun periode tidak ditemukan di dokumen.",
    );
  }

  return {
    ok: true,
    sheet: { headers: HEADERS, rows: sheetRows, delimiter: "" },
    pages,
    hasBalance: bands.some((b) => b.role === "balance"),
    yearFilled,
  };
}
