import { getCategory } from "../categories";
import type { Transaction } from "../types";
import { createZip, type ZipEntry } from "./zip";

/**
 * Membuat file .xlsx asli, bukan CSV yang diberi nama .xlsx.
 *
 * Bedanya nyata untuk aplikasi keuangan: nominal masuk sebagai angka yang bisa
 * langsung dijumlahkan, tanggal sebagai tanggal yang bisa diurutkan dan
 * difilter, dan baris judul tercetak tebal serta dibekukan. Dengan CSV, Excel
 * harus menebak semuanya — dan di lokal Indonesia sering salah menebak koma
 * desimal.
 *
 * Semua ditulis tangan di atas penulis ZIP kita sendiri, tanpa dependency.
 */

function esc(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Excel menyimpan tanggal sebagai jumlah hari sejak 1899-12-30. */
function toExcelSerial(iso: string): number {
  const d = new Date(`${iso}T00:00:00Z`);
  return Math.round((d.getTime() - Date.UTC(1899, 11, 30)) / 86_400_000);
}

/** 0 -> A, 1 -> B, … */
function columnName(index: number): string {
  let name = "";
  let i = index;
  do {
    name = String.fromCharCode(65 + (i % 26)) + name;
    i = Math.floor(i / 26) - 1;
  } while (i >= 0);
  return name;
}

type CellValue = { t: "text"; v: string } | { t: "number"; v: number } | { t: "date"; v: string };

/** Indeks gaya, sesuai urutan cellXfs di styles.xml di bawah. */
const STYLE_DEFAULT = 0;
const STYLE_HEADER = 1;
const STYLE_DATE = 2;
const STYLE_MONEY = 3;

function cellXml(ref: string, cell: CellValue, isHeader: boolean): string {
  if (isHeader) {
    return `<c r="${ref}" s="${STYLE_HEADER}" t="inlineStr"><is><t>${esc(String(cell.v))}</t></is></c>`;
  }
  if (cell.t === "number") {
    return `<c r="${ref}" s="${STYLE_MONEY}"><v>${cell.v}</v></c>`;
  }
  if (cell.t === "date") {
    return `<c r="${ref}" s="${STYLE_DATE}"><v>${toExcelSerial(cell.v)}</v></c>`;
  }
  return `<c r="${ref}" s="${STYLE_DEFAULT}" t="inlineStr"><is><t>${esc(cell.v)}</t></is></c>`;
}

function sheetXml(header: string[], rows: CellValue[][]): string {
  const lines: string[] = [];

  lines.push(
    `<row r="1">${header
      .map((h, i) => cellXml(`${columnName(i)}1`, { t: "text", v: h }, true))
      .join("")}</row>`,
  );

  rows.forEach((row, r) => {
    const n = r + 2;
    lines.push(
      `<row r="${n}">${row.map((c, i) => cellXml(`${columnName(i)}${n}`, c, false)).join("")}</row>`,
    );
  });

  const lastCol = columnName(Math.max(0, header.length - 1));

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>
<cols><col min="1" max="1" width="12"/><col min="2" max="2" width="14"/><col min="3" max="3" width="22"/><col min="4" max="4" width="16"/><col min="5" max="5" width="34"/></cols>
<sheetData>${lines.join("")}</sheetData>
<autoFilter ref="A1:${lastCol}${rows.length + 1}"/>
</worksheet>`;
}

/**
 * `numFmtId="164"` adalah format kustom rupiah yang didefinisikan di numFmts.
 * Angka negatif ikut memakai format yang sama supaya pengeluaran tetap terbaca
 * sebagai angka, bukan teks.
 */
const STYLES_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<numFmts count="2">
<numFmt numFmtId="164" formatCode="&quot;Rp&quot;\\ #,##0;[Red]-&quot;Rp&quot;\\ #,##0"/>
<numFmt numFmtId="165" formatCode="dd/mm/yyyy"/>
</numFmts>
<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts>
<fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFF1E6DA"/><bgColor indexed="64"/></patternFill></fill></fills>
<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="4">
<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
<xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/>
<xf numFmtId="165" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
<xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
</cellXfs>
</styleSheet>`;

function workbookParts(sheetName: string, sheet: string): ZipEntry[] {
  return [
    {
      path: "[Content_Types].xml",
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
</Types>`,
    },
    {
      path: "_rels/.rels",
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`,
    },
    {
      path: "xl/workbook.xml",
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheets><sheet name="${esc(sheetName)}" sheetId="1" r:id="rId1"/></sheets>
</workbook>`,
    },
    {
      path: "xl/_rels/workbook.xml.rels",
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`,
    },
    { path: "xl/styles.xml", content: STYLES_XML },
    { path: "xl/worksheets/sheet1.xml", content: sheet },
  ];
}

/** Blob .xlsx berisi seluruh transaksi yang diberikan. */
export function buildTransactionsXlsx(transactions: Transaction[]): Blob {
  const header = ["Tanggal", "Tipe", "Kategori", "Nominal", "Catatan"];

  const rows: CellValue[][] = [...transactions]
    .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt)
    .map((t) => [
      { t: "date", v: t.date },
      { t: "text", v: t.type === "in" ? "Pemasukan" : "Pengeluaran" },
      { t: "text", v: getCategory(t.categoryId).label },
      // Pengeluaran ditulis negatif supaya SUM satu kolom langsung memberi saldo.
      { t: "number", v: t.type === "in" ? t.amount : -t.amount },
      { t: "text", v: t.note },
    ]);

  return createZip(workbookParts("Transaksi", sheetXml(header, rows)));
}
