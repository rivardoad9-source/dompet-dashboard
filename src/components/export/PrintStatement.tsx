"use client";

import { getCategory } from "@/lib/categories";
import { formatDate, formatIDR, monthLabel } from "@/lib/format";
import type { BudgetSummary, MonthTotals } from "@/lib/stats";
import type { Transaction } from "@/lib/types";

/**
 * Tata letak khusus cetak — tidak pernah terlihat di layar.
 *
 * Bentuknya sengaja seperti laporan keuangan cetak, bukan salinan dashboard:
 * kop, periode, ringkasan, rekap anggaran per kategori, lalu daftar transaksi
 * lengkap. Tanpa grafik, tanpa warna, tanpa navigasi — semuanya cuma memakan
 * tinta dan mengurangi keterbacaan di atas kertas.
 */
export function PrintStatement({
  monthKey,
  transactions,
  summary,
  totals,
  ownerName,
  scopeLabel,
}: {
  monthKey: string;
  transactions: Transaction[];
  summary: BudgetSummary;
  totals: MonthTotals;
  ownerName: string;
  scopeLabel: string;
}) {
  const rows = [...transactions].sort(
    (a, b) => a.date.localeCompare(b.date) || a.createdAt - b.createdAt,
  );
  const budgeted = summary.rows.filter((r) => r.limit > 0 || r.spent > 0);

  return (
    <div className="dp-print-only text-[11pt] text-black">
      {/* Kop */}
      <header style={{ borderBottom: "2px solid #000", paddingBottom: "8pt" }}>
        <h1 className="text-[20pt] font-extrabold leading-tight">Laporan Keuangan</h1>
        <p className="mt-1 text-[11pt]">
          {ownerName ? `${ownerName} · ` : ""}
          {scopeLabel}
        </p>
        <p className="mt-0.5 text-[9pt]" style={{ color: "#555" }}>
          Dibuat {formatDate(new Date().toISOString().slice(0, 10))} · Dompet Personal Finance
        </p>
      </header>

      {/* Ringkasan */}
      <section style={{ marginTop: "14pt" }}>
        <h2 className="text-[13pt] font-bold">Ringkasan {monthLabel(monthKey)}</h2>
        <table className="mt-2 w-full text-[11pt]" style={{ borderCollapse: "collapse" }}>
          <tbody>
            <SummaryRow label="Total pemasukan" value={formatIDR(totals.income)} />
            <SummaryRow label="Total pengeluaran" value={formatIDR(totals.expense)} />
            <SummaryRow
              label="Selisih"
              value={formatIDR(totals.net)}
              bold
            />
            <SummaryRow
              label="Plafon anggaran"
              value={summary.limit > 0 ? formatIDR(summary.limit) : "—"}
            />
            <SummaryRow
              label="Realisasi terhadap plafon"
              value={summary.limit > 0 ? `${Math.round(summary.pct)}%` : "—"}
            />
          </tbody>
        </table>
      </section>

      {/* Anggaran per kategori */}
      {budgeted.length > 0 ? (
        <section style={{ marginTop: "16pt" }}>
          <h2 className="text-[13pt] font-bold">Anggaran per Kategori</h2>
          <table className="mt-2 w-full text-[10pt]" style={{ borderCollapse: "collapse" }}>
            <thead className="dp-print-head">
              <tr>
                <Th>Kategori</Th>
                <Th align="right">Plafon</Th>
                <Th align="right">Realisasi</Th>
                <Th align="right">Sisa</Th>
                <Th align="right">%</Th>
              </tr>
            </thead>
            <tbody>
              {budgeted.map((r) => (
                <tr key={r.categoryId} className="dp-print-row">
                  <Td>{r.label}</Td>
                  <Td align="right">{r.limit > 0 ? formatIDR(r.limit) : "—"}</Td>
                  <Td align="right">{formatIDR(r.spent)}</Td>
                  <Td align="right">{r.limit > 0 ? formatIDR(r.remaining) : "—"}</Td>
                  <Td align="right">{r.limit > 0 ? `${Math.round(r.pct)}%` : "—"}</Td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ) : null}

      {/* Transaksi */}
      <section style={{ marginTop: "16pt" }}>
        <h2 className="text-[13pt] font-bold">Rincian Transaksi ({rows.length})</h2>
        {rows.length ? (
          <table className="mt-2 w-full text-[9.5pt]" style={{ borderCollapse: "collapse" }}>
            <thead className="dp-print-head">
              <tr>
                <Th>Tanggal</Th>
                <Th>Kategori</Th>
                <Th>Catatan</Th>
                <Th align="right">Nominal</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((t) => (
                <tr key={t.id} className="dp-print-row">
                  <Td>{formatDate(t.date)}</Td>
                  <Td>{getCategory(t.categoryId).label}</Td>
                  <Td>{t.note || "—"}</Td>
                  <Td align="right">
                    {t.type === "in" ? "+" : "−"}
                    {formatIDR(t.amount)}
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="mt-2 text-[10pt]">Tidak ada transaksi pada periode ini.</p>
        )}
      </section>

      <footer
        style={{ marginTop: "18pt", borderTop: "1px solid #999", paddingTop: "6pt", color: "#555" }}
        className="text-[8.5pt]"
      >
        Data berasal dari penyimpanan lokal perangkat. Laporan ini dibuat sendiri oleh pengguna dan
        bukan dokumen resmi dari lembaga keuangan mana pun.
      </footer>
    </div>
  );
}

function SummaryRow({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <tr>
      <td style={{ padding: "3pt 0", borderBottom: "1px solid #ddd" }}>{label}</td>
      <td
        style={{
          padding: "3pt 0",
          borderBottom: "1px solid #ddd",
          textAlign: "right",
          fontWeight: bold ? 700 : 400,
        }}
      >
        {value}
      </td>
    </tr>
  );
}

function Th({ children, align = "left" }: { children: React.ReactNode; align?: "left" | "right" }) {
  return (
    <th
      style={{
        textAlign: align,
        padding: "4pt 4pt",
        borderBottom: "1.5px solid #000",
        fontWeight: 700,
      }}
    >
      {children}
    </th>
  );
}

function Td({ children, align = "left" }: { children: React.ReactNode; align?: "left" | "right" }) {
  return (
    <td style={{ textAlign: align, padding: "3pt 4pt", borderBottom: "1px solid #e5e5e5" }}>
      {children}
    </td>
  );
}
