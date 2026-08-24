"use client";

import { AlertTriangle, CheckCircle2, FileText, FileUp, Table2 } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { getCategory } from "@/lib/categories";
import { readBackupFile } from "@/lib/export";
import { formatDate, formatIDR } from "@/lib/format";
import {
  buildTransactions,
  guessMapping,
  parseDelimited,
  type ColumnMapping,
  type ParsedSheet,
} from "@/lib/formats/csv-import";
import { parsePdfStatement } from "@/lib/formats/pdf-import";
import { parseXlsx } from "@/lib/formats/xlsx-import";
import { actions, readState } from "@/lib/store";
import { Button } from "@/components/ui/Button";
import { Field, Select } from "@/components/ui/Field";
import { Segmented } from "@/components/ui/Segmented";
import { Sheet } from "@/components/ui/Sheet";
import { useToast } from "@/components/ui/Toast";

type Mode = "append" | "replace";

/**
 * Wizard impor dari aplikasi lain.
 *
 * Ekspor pencatat keuangan tidak punya format baku, jadi menebak saja tidak
 * cukup — dan menebak diam-diam pada data keuangan berbahaya. Alurnya: baca
 * berkas, tebak kolomnya, lalu **tunjukkan tebakan itu beserta pratinjau baris
 * yang akan masuk** supaya pengguna bisa mengoreksi sebelum apa pun disimpan.
 *
 * Rekening koran PDF masuk lewat jalur yang sama: `parsePdfStatement` mengubah
 * tabelnya menjadi `ParsedSheet`, lalu diperlakukan persis seperti CSV — tebak
 * kolom, tampilkan, biarkan pengguna membetulkan.
 *
 * Berkas .json Dompet tetap ditangani jalur lama (pemulihan penuh).
 */

/** Hal-hal khusus PDF yang perlu diberitahukan sebelum pengguna menekan Impor. */
interface PdfNotice {
  hasBalance: boolean;
  yearFilled: boolean;
  pages: number;
}

type FileKind = "json" | "pdf" | "xlsx" | "delimited";

/**
 * Menentukan jenis berkas dari isinya, bukan dari namanya.
 *
 * Nama berkas bukan sumber yang bisa dipercaya di ponsel: sebagian file
 * manager Android menyerahkan berkas tanpa ekstensi, atau dengan nama hasil
 * salinan seperti "document(1)". Tiga byte pertama sudah cukup memastikan —
 * "PK" untuk .xlsx (arsip zip), "%PDF" untuk PDF, "{" untuk backup Dompet.
 * Sisanya diperlakukan sebagai teks berpemisah, yang juga merupakan tebakan
 * paling aman kalau ternyata bukan apa-apa.
 */
async function detectKind(file: File): Promise<FileKind> {
  try {
    const head = new Uint8Array(await file.slice(0, 8).arrayBuffer());

    if (head[0] === 0x50 && head[1] === 0x4b) return "xlsx"; // "PK"
    if (head[0] === 0x25 && head[1] === 0x50 && head[2] === 0x44 && head[3] === 0x46) return "pdf";

    // Lewati spasi/BOM di depan sebelum menyimpulkan JSON.
    for (const byte of head) {
      if (byte === 0x7b) return "json"; // "{"
      if (byte > 0x20 && byte !== 0xef && byte !== 0xbb && byte !== 0xbf) break;
    }
  } catch {
    // Tidak bisa mengintip isinya — jatuh kembali ke ekstensi di bawah.
  }

  if (/\.json$/i.test(file.name)) return "json";
  if (/\.pdf$/i.test(file.name)) return "pdf";
  if (/\.xlsx$/i.test(file.name)) return "xlsx";
  return "delimited";
}

export function ImportSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);

  const [sheet, setSheet] = useState<ParsedSheet | null>(null);
  const [mapping, setMapping] = useState<ColumnMapping | null>(null);
  const [mode, setMode] = useState<Mode>("append");
  const [filename, setFilename] = useState("");
  const [busy, setBusy] = useState(false);
  const [pdf, setPdf] = useState<PdfNotice | null>(null);

  const preview = useMemo(
    () => (sheet && mapping ? buildTransactions(sheet, mapping) : null),
    [sheet, mapping],
  );

  function reset() {
    setSheet(null);
    setMapping(null);
    setFilename("");
    setMode("append");
    setPdf(null);
  }

  function closeAll() {
    reset();
    onClose();
  }

  async function onFile(file: File) {
    setBusy(true);
    setFilename(file.name);

    try {
      const kind = await detectKind(file);

      // Backup Dompet sendiri: pulihkan utuh, tidak perlu pemetaan kolom.
      if (kind === "json") {
        const result = await readBackupFile(file);
        if (!result.ok || !result.state) {
          toast.error(result.error ?? "Gagal membaca file.");
          return;
        }
        actions.replaceState(result.state, "Pulihkan dari backup");
        toast.success("Data berhasil dipulihkan");
        closeAll();
        return;
      }

      // Rekening koran PDF: ubah dulu jadi tabel, sisanya alur yang sama.
      if (kind === "pdf") {
        const result = await parsePdfStatement(await file.arrayBuffer());
        if (!result.ok) {
          toast.error(result.message);
          setFilename("");
          return;
        }

        setSheet(result.sheet);
        setMapping(guessMapping(result.sheet));
        setPdf({
          hasBalance: result.hasBalance,
          yearFilled: result.yearFilled,
          pages: result.pages,
        });
        return;
      }

      // Excel dari aplikasi lain (Money Manager, Wallet, dsb).
      if (kind === "xlsx") {
        const result = await parseXlsx(await file.arrayBuffer());
        if (!result.ok) {
          toast.error(result.message);
          setFilename("");
          return;
        }

        setSheet(result.sheet);
        setMapping(guessMapping(result.sheet));
        return;
      }

      const text = await file.text();
      const parsed = parseDelimited(text);

      // Pesan dibedakan supaya pengguna tahu harus memperbaiki apa.
      if (!parsed.headers.length) {
        toast.error("File ini kosong atau bukan berkas teks yang bisa dibaca.");
        setFilename("");
        return;
      }
      if (!parsed.rows.length) {
        toast.error("File ini hanya berisi baris judul, tanpa data transaksi.");
        setFilename("");
        return;
      }

      setSheet(parsed);
      setMapping(guessMapping(parsed));
    } catch {
      toast.error("Gagal membaca file.");
      setFilename("");
    } finally {
      setBusy(false);
    }
  }

  function commit() {
    if (!preview?.transactions.length) return;

    if (mode === "replace") {
      const current = readState();
      actions.replaceState(
        { ...current, transactions: preview.transactions },
        "Impor: ganti semua transaksi",
      );
    } else {
      actions.addTransactions(preview.transactions);
    }

    toast.success(`${preview.transactions.length} transaksi diimpor`);
    closeAll();
  }

  const columnOptions = (sheet?.headers ?? []).map((h, i) => ({
    value: String(i),
    label: h || `Kolom ${i + 1}`,
  }));

  return (
    <Sheet
      open={open}
      onClose={closeAll}
      title={sheet ? "Cocokkan Kolom" : "Impor Data"}
      description={
        sheet
          ? `${filename} · ${sheet.rows.length} baris terbaca${pdf ? ` dari ${pdf.pages} halaman` : ""}`
          : "Excel/CSV dari aplikasi lain, rekening koran PDF, atau backup Dompet"
      }
      size={sheet ? "lg" : "md"}
      footer={
        sheet ? (
          <div className="flex gap-3">
            <Button variant="secondary" size="lg" onClick={reset}>
              Ganti file
            </Button>
            <Button
              size="lg"
              className="flex-1"
              disabled={!preview?.transactions.length}
              onClick={commit}
            >
              Impor {preview?.transactions.length ?? 0} transaksi
            </Button>
          </div>
        ) : undefined
      }
    >
      {!sheet ? (
        <div className="space-y-4 pb-4">
          <button
            type="button"
            disabled={busy}
            onClick={() => fileRef.current?.click()}
            className={cn(
              "flex w-full cursor-pointer flex-col items-center gap-3 rounded-card border-2 border-dashed border-line p-8",
              "transition-colors duration-200 hover:border-brand hover:bg-surface-2",
              "disabled:pointer-events-none disabled:opacity-50",
            )}
          >
            <span className="grid size-14 place-items-center rounded-2xl bg-brand-soft text-brand">
              <FileUp className="size-7" />
            </span>
            <span className="text-sm font-bold text-ink">
              {busy ? "Membaca…" : "Pilih file"}
            </span>
            <span className="text-center text-[11px] leading-relaxed text-ink-muted">
              <strong className="text-ink-muted">Excel (.xlsx)</strong> atau CSV dari aplikasi
              pencatat keuangan lain, rekening koran <strong className="text-ink-muted">PDF</strong>{" "}
              dari bank — juga file backup .json dari Dompet.
            </span>
          </button>

          <div className="flex items-start gap-2.5 rounded-xl bg-surface-2 p-3">
            <FileText className="mt-0.5 size-4 shrink-0 text-ink-faint" />
            <p className="text-[11px] leading-relaxed text-ink-muted">
              PDF-nya harus yang asli dari bank atau internet banking, bukan hasil scan atau
              foto — teksnya perlu bisa diseleksi. Kalau filenya terkunci password, buka dulu
              lalu simpan ulang tanpa password.
            </p>
          </div>

          <div className="flex items-start gap-2.5 rounded-xl bg-surface-2 p-3">
            <Table2 className="mt-0.5 size-4 shrink-0 text-ink-faint" />
            <p className="text-[11px] leading-relaxed text-ink-muted">
              Ekspor dari <em>Money Manager</em>, <em>Wallet</em>, dan sejenisnya bisa langsung
              dipilih tanpa dikonversi dulu. Kategori ber-emoji seperti <em>🍔 Food</em>, kolom{" "}
              <em>Income/Expense</em>, dan nominal seperti <em>Rp 25.000</em> atau{" "}
              <em>40000.0</em> semuanya sudah dikenali.
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-5 pb-4">
          <p className="text-[11px] leading-relaxed text-ink-muted">
            {pdf
              ? "Kolom di bawah dibaca dari tata letak tabel di PDF-mu. Periksa sekilas, betulkan yang keliru — tidak ada yang tersimpan sampai kamu menekan Impor."
              : "Ini tebakan otomatis dari judul kolom di filemu. Periksa sekilas, betulkan yang keliru — tidak ada yang tersimpan sampai kamu menekan Impor."}
          </p>

          {/* Dua hal yang khas rekening koran dan bisa diam-diam merusak hasil. */}
          {pdf?.hasBalance ? (
            <p
              className="rounded-xl px-3 py-2.5 text-[11px] leading-relaxed"
              style={{ background: "var(--warning-soft)", color: "var(--warning)" }}
            >
              <strong>Kolom Saldo terdeteksi dan sengaja dibiarkan kosong.</strong> Itu saldo
              berjalan rekening, bukan nominal transaksi — jangan dipetakan ke Nominal kecuali
              kamu memang yakin.
            </p>
          ) : null}

          {pdf?.yearFilled ? (
            <p
              className="rounded-xl px-3 py-2.5 text-[11px] leading-relaxed"
              style={{ background: "var(--warning-soft)", color: "var(--warning)" }}
            >
              <strong>Tanggal di PDF ini ditulis tanpa tahun.</strong> Tahunnya diambil dari
              periode yang tertera di dokumen — pastikan tanggal di pratinjau sudah benar.
            </p>
          ) : null}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <MapField
              label="Tanggal"
              value={mapping?.date ?? -1}
              options={columnOptions}
              onChange={(v) => setMapping((m) => (m ? { ...m, date: v } : m))}
            />
            <MapField
              label="Nominal"
              value={mapping?.amount ?? -1}
              options={columnOptions}
              onChange={(v) => setMapping((m) => (m ? { ...m, amount: v } : m))}
            />
            <MapField
              label="Kategori"
              value={mapping?.category ?? -1}
              options={columnOptions}
              optional
              onChange={(v) => setMapping((m) => (m ? { ...m, category: v } : m))}
            />
            <MapField
              label="Catatan"
              value={mapping?.note ?? -1}
              options={columnOptions}
              optional
              onChange={(v) => setMapping((m) => (m ? { ...m, note: v } : m))}
            />
            <MapField
              label="Tipe (masuk/keluar)"
              value={mapping?.type ?? -1}
              options={columnOptions}
              optional
              hint="Kolom berisi kata seperti Pengeluaran atau Income"
              onChange={(v) => setMapping((m) => (m ? { ...m, type: v } : m))}
            />
            <MapField
              label="Kolom pemasukan terpisah"
              value={mapping?.amountIn ?? -1}
              options={columnOptions}
              optional
              hint="Kalau filemu punya kolom Debit dan Kredit terpisah"
              onChange={(v) => setMapping((m) => (m ? { ...m, amountIn: v } : m))}
            />
          </div>

          {/* Hasil */}
          <div className="space-y-2">
            <div
              className="flex items-center gap-2.5 rounded-xl p-3"
              style={{
                background: preview?.transactions.length ? "var(--success-soft)" : "var(--danger-soft)",
                color: preview?.transactions.length ? "var(--success)" : "var(--danger)",
              }}
            >
              {preview?.transactions.length ? (
                <CheckCircle2 className="size-4 shrink-0" />
              ) : (
                <AlertTriangle className="size-4 shrink-0" />
              )}
              <p className="text-xs font-semibold">
                {preview?.transactions.length
                  ? `${preview.transactions.length} baris siap diimpor`
                  : "Belum ada baris yang bisa dibaca — cek pemetaan kolom di atas"}
              </p>
            </div>

            {preview?.skipped.length ? (
              <p className="text-[11px] leading-relaxed text-ink-muted">
                {preview.skipped.length} baris dilewati ({preview.skipped[0].reason}
                {preview.skipped.length > 1 ? ", dan lainnya" : ""}).
              </p>
            ) : null}

            <p className="text-[11px] text-ink-faint">
              Tanggal dibaca sebagai{" "}
              <strong className="text-ink-muted">
                {preview?.dayFirst ? "hari/bulan/tahun" : "bulan/hari/tahun"}
              </strong>
              .
            </p>
          </div>

          {/* Pratinjau */}
          {preview?.transactions.length ? (
            <div>
              <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-ink-muted">
                Pratinjau 5 baris pertama
              </p>
              <ul className="space-y-1.5">
                {preview.transactions.slice(0, 5).map((t) => (
                  <li
                    key={t.id}
                    className="flex items-center gap-3 rounded-xl bg-surface-2 px-3 py-2.5"
                  >
                    <span className="w-24 shrink-0 text-[11px] font-semibold text-ink-muted">
                      {formatDate(t.date)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xs font-semibold text-ink">
                        {t.note || getCategory(t.categoryId).label}
                      </span>
                      <span className="block text-[10px] text-ink-faint">
                        {getCategory(t.categoryId).label}
                      </span>
                    </span>
                    <span
                      className="shrink-0 text-xs font-bold tabular-nums"
                      style={{ color: t.type === "in" ? "var(--success)" : "var(--ink)" }}
                    >
                      {t.type === "in" ? "+" : "−"}
                      {formatIDR(t.amount)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <Field label="Cara memasukkan">
            <Segmented
              name="Mode impor"
              value={mode}
              onChange={setMode}
              options={[
                { value: "append", label: "Tambahkan" },
                { value: "replace", label: "Ganti semua", colorVar: "--danger" },
              ]}
            />
          </Field>

          {mode === "replace" ? (
            <p
              className="rounded-xl px-3 py-2.5 text-[11px] font-medium leading-relaxed"
              style={{ background: "var(--danger-soft)", color: "var(--danger)" }}
            >
              Semua transaksi yang ada sekarang akan dihapus dan diganti isi file ini. Anggaran
              dan target tabungan tidak ikut terhapus. Masih bisa diurungkan lewat kartu{" "}
              <strong>Keamanan Data</strong> di Pengaturan kalau ternyata salah pilih.
            </p>
          ) : null}
        </div>
      )}

      <input
        ref={fileRef}
        type="file"
        /*
         * Sengaja longgar. Filter yang ketat membuat berkas jadi abu-abu dan
         * tidak bisa dipilih di Android, karena file manager di sana kerap
         * melaporkan .csv sebagai application/octet-stream atau bahkan
         * application/vnd.ms-excel. Jenis berkasnya divalidasi dari isinya di
         * `detectKind`, jadi tidak ada yang hilang dengan melonggarkan ini.
         */
        accept=".xlsx,.pdf,.csv,.tsv,.txt,.json,text/csv,text/comma-separated-values,text/plain,text/tab-separated-values,application/csv,application/x-csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/pdf,application/json,application/octet-stream"
        className="sr-only"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void onFile(file);
          e.target.value = "";
        }}
      />
    </Sheet>
  );
}

function MapField({
  label,
  value,
  options,
  onChange,
  optional,
  hint,
}: {
  label: string;
  value: number;
  options: Array<{ value: string; label: string }>;
  onChange: (index: number) => void;
  optional?: boolean;
  hint?: string;
}) {
  return (
    <Field label={label} hint={hint}>
      <Select value={String(value)} onChange={(e) => onChange(Number(e.target.value))}>
        <option value="-1">{optional ? "— tidak ada —" : "— pilih kolom —"}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </Select>
    </Field>
  );
}
