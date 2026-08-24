/**
 * Penulis ZIP minimal — hanya metode "store" (tanpa kompresi).
 *
 * Dipakai untuk membuat file .xlsx, yang sebenarnya cuma arsip ZIP berisi
 * beberapa berkas XML. Menuliskannya sendiri jauh lebih murah daripada menarik
 * pustaka spreadsheet: implementasi lengkapnya di bawah 100 baris, sementara
 * pustaka semacam itu menambah ratusan kilobyte ke bundel.
 *
 * Tanpa kompresi memang membuat filenya lebih besar, tapi laporan transaksi
 * berukuran puluhan kilobyte — tidak ada bedanya dalam praktik, dan Excel,
 * Google Sheets, serta LibreOffice membacanya sama saja.
 */

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

export interface ZipEntry {
  /** Jalur di dalam arsip, mis. "xl/worksheets/sheet1.xml". */
  path: string;
  content: string;
}

/** Tanggal MS-DOS yang dipakai header ZIP (presisi 2 detik). */
function dosDateTime(d: Date): { time: number; date: number } {
  return {
    time: (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1),
    date: ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate(),
  };
}

export function createZip(entries: ZipEntry[], now = new Date()): Blob {
  const encoder = new TextEncoder();
  const { time, date } = dosDateTime(now);

  const locals: Uint8Array[] = [];
  const centrals: Uint8Array[] = [];
  let offset = 0;

  for (const entry of entries) {
    const name = encoder.encode(entry.path);
    const data = encoder.encode(entry.content);
    const crc = crc32(data);

    // Local file header (30 byte) + nama + data
    const local = new Uint8Array(30 + name.length + data.length);
    const lv = new DataView(local.buffer);
    lv.setUint32(0, 0x04034b50, true); // signature
    lv.setUint16(4, 20, true); // versi minimum
    lv.setUint16(6, 0x0800, true); // flag: nama berkas UTF-8
    lv.setUint16(8, 0, true); // metode: store
    lv.setUint16(10, time, true);
    lv.setUint16(12, date, true);
    lv.setUint32(14, crc, true);
    lv.setUint32(18, data.length, true); // ukuran terkompresi
    lv.setUint32(22, data.length, true); // ukuran asli
    lv.setUint16(26, name.length, true);
    lv.setUint16(28, 0, true); // panjang extra field
    local.set(name, 30);
    local.set(data, 30 + name.length);
    locals.push(local);

    // Central directory header (46 byte) + nama
    const central = new Uint8Array(46 + name.length);
    const cv = new DataView(central.buffer);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(4, 20, true); // versi pembuat
    cv.setUint16(6, 20, true); // versi minimum
    cv.setUint16(8, 0x0800, true);
    cv.setUint16(10, 0, true);
    cv.setUint16(12, time, true);
    cv.setUint16(14, date, true);
    cv.setUint32(16, crc, true);
    cv.setUint32(20, data.length, true);
    cv.setUint32(24, data.length, true);
    cv.setUint16(28, name.length, true);
    cv.setUint32(42, offset, true); // posisi local header
    central.set(name, 46);
    centrals.push(central);

    offset += local.length;
  }

  const centralSize = centrals.reduce((s, c) => s + c.length, 0);

  // End of central directory (22 byte)
  const end = new Uint8Array(22);
  const ev = new DataView(end.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(8, entries.length, true);
  ev.setUint16(10, entries.length, true);
  ev.setUint32(12, centralSize, true);
  ev.setUint32(16, offset, true);

  return new Blob([...locals, ...centrals, end] as BlobPart[], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}
