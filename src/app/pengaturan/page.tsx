"use client";

import {
  Database,
  Download,
  Eye,
  FileJson,
  Info,
  Moon,
  Palette,
  RotateCcw,
  Share2,
  Smartphone,
  Trash2,
  Upload,
  User,
} from "lucide-react";
import { useRef, useState } from "react";
import {
  exportBackupJson,
  exportTransactionsCsv,
  readBackupFile,
  shareBackupJson,
} from "@/lib/export";
import { STORAGE_KEY, actions, useStore } from "@/lib/store";
import { PageIntro } from "@/components/shell/AppShell";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { ConfirmDialog, Skeleton } from "@/components/ui/Feedback";
import { Field, Input } from "@/components/ui/Field";
import { Segmented } from "@/components/ui/Segmented";
import { useToast } from "@/components/ui/Toast";

export default function PengaturanPage() {
  const { state, hydrated } = useStore();
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [confirm, setConfirm] = useState<"clear" | "demo" | null>(null);
  const [sharing, setSharing] = useState(false);

  if (!hydrated) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-44 rounded-card" />
        ))}
      </div>
    );
  }

  const { settings, transactions, goals, budgets } = state;
  const bytes = typeof window !== "undefined" ? (window.localStorage.getItem(STORAGE_KEY)?.length ?? 0) : 0;

  async function onImport(file: File) {
    const result = await readBackupFile(file);
    if (!result.ok || !result.state) {
      toast.error(result.error ?? "Gagal membaca file.");
      return;
    }
    actions.replaceState(result.state);
    toast.success("Data berhasil dipulihkan");
  }

  return (
    <div className="space-y-4 lg:space-y-5">
      <PageIntro title="Pengaturan" description="Profil, tampilan, dan data" />

      <div className="grid grid-cols-12 gap-4 lg:gap-5">
        {/* --- Data ---
             Sengaja paling atas: tanpa akun dan tanpa server, backup adalah
             satu-satunya pengaman data pengguna, jadi inilah yang harus terlihat
             lebih dulu saat halaman ini dibuka dari HP.
             Urutannya diatur lewat DOM, bukan CSS order, supaya urutan fokus
             keyboard dan pembaca layar sama persis dengan yang terlihat mata. */}
        <Card className="dp-rise col-span-12 xl:col-span-7">
          <CardHeader
            title="Data & Backup"
            subtitle="Pindah HP, simpan cadangan, atau ekspor ke spreadsheet"
          />
          <CardBody className="space-y-4 pt-2">
            {/* Dua aksi utama, dibedakan dari yang lain karena inilah jalur
                pindah perangkat. */}
            <div className="grid gap-3 sm:grid-cols-2">
              <Button
                size="lg"
                className="justify-start"
                disabled={sharing}
                onClick={async () => {
                  setSharing(true);
                  const outcome = await shareBackupJson(state);
                  setSharing(false);
                  if (outcome === "shared") toast.success("Backup dikirim");
                  else if (outcome === "downloaded") toast.success("Backup JSON diunduh");
                }}
              >
                <Share2 className="size-4" />
                {sharing ? "Menyiapkan…" : "Backup & Kirim"}
              </Button>

              <Button
                variant="secondary"
                size="lg"
                className="justify-start"
                onClick={() => fileRef.current?.click()}
              >
                <Upload className="size-4" />
                Pulihkan dari JSON
              </Button>
              <input
                ref={fileRef}
                type="file"
                accept="application/json,.json"
                className="sr-only"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void onImport(file);
                  e.target.value = "";
                }}
              />
            </div>

            <div className="flex items-start gap-2.5 rounded-xl bg-surface-2 p-3">
              <Smartphone className="mt-0.5 size-4 shrink-0 text-ink-faint" />
              <p className="text-[11px] leading-relaxed text-ink-muted">
                <strong className="font-bold text-ink">Ganti HP?</strong> Ketuk{" "}
                <em>Backup &amp; Kirim</em> di HP lama — filenya bisa langsung dikirim ke WhatsApp,
                email, atau Drive. Buka aplikasi di HP baru, ketuk{" "}
                <em>Pulihkan dari JSON</em>, pilih file itu. Selesai.
              </p>
            </div>

            <div className="border-t border-line pt-4">
              <p className="mb-3 text-[11px] font-bold uppercase tracking-wider text-ink-muted">
                Lainnya
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                <Button
                  variant="secondary"
                  className="justify-start"
                  onClick={() => {
                    if (!transactions.length) {
                      toast.error("Belum ada transaksi untuk diekspor.");
                      return;
                    }
                    const count = exportTransactionsCsv(transactions);
                    toast.success(`${count} transaksi diekspor ke CSV`);
                  }}
                >
                  <Download className="size-4" />
                  Ekspor CSV / Excel
                </Button>

                <Button
                  variant="secondary"
                  className="justify-start"
                  onClick={() => {
                    exportBackupJson(state);
                    toast.success("Backup JSON diunduh");
                  }}
                >
                  <FileJson className="size-4" />
                  Unduh backup saja
                </Button>

                <Button
                  variant="secondary"
                  className="justify-start"
                  onClick={() => setConfirm("demo")}
                >
                  <RotateCcw className="size-4" />
                  Muat ulang data demo
                </Button>

                <Button
                  variant="danger"
                  className="justify-start"
                  onClick={() => setConfirm("clear")}
                >
                  <Trash2 className="size-4" />
                  Hapus semua data
                </Button>
              </div>
            </div>
          </CardBody>
        </Card>

        {/* --- Profil --- */}
        <Card className="dp-rise col-span-12 xl:col-span-5">
          <CardHeader title="Profil" subtitle="Nama yang muncul di sapaan beranda" />
          <CardBody className="space-y-4 pt-2">
            <Field label="Nama panggilan" htmlFor="nama">
              <Input
                id="nama"
                value={settings.name}
                maxLength={24}
                placeholder="Nama kamu"
                onChange={(e) => actions.setSettings({ name: e.target.value })}
              />
            </Field>
            <div className="flex items-start gap-2.5 rounded-xl bg-surface-2 p-3">
              <User className="mt-0.5 size-4 shrink-0 text-ink-faint" />
              <p className="text-[11px] leading-relaxed text-ink-muted">
                Tidak ada akun, tidak ada server. Semua data hidup di browser perangkat ini saja.
              </p>
            </div>
          </CardBody>
        </Card>

        {/* --- Tampilan --- */}
        <Card className="dp-rise col-span-12 xl:col-span-6">
          <CardHeader title="Tampilan" subtitle="Tema dan privasi layar" />
          <CardBody className="space-y-4 pt-2">
            <Field label="Tema">
              <Segmented
                name="Tema"
                value={settings.theme}
                onChange={(theme) => actions.setSettings({ theme })}
                options={[
                  { value: "warm", label: "Warm" },
                  { value: "midnight", label: "Midnight" },
                ]}
              />
            </Field>

            <ToggleRow
              icon={<Eye className="size-4" />}
              title="Sembunyikan nominal"
              description="Ganti semua angka rupiah dengan titik — berguna saat screenshot."
              checked={settings.privacy}
              onChange={(privacy) => actions.setSettings({ privacy })}
            />

            <div className="flex items-start gap-2.5 rounded-xl bg-surface-2 p-3">
              {settings.theme === "midnight" ? (
                <Moon className="mt-0.5 size-4 shrink-0 text-ink-faint" />
              ) : (
                <Palette className="mt-0.5 size-4 shrink-0 text-ink-faint" />
              )}
              <p className="text-[11px] leading-relaxed text-ink-muted">
                Warna diambil dari satu blok token di{" "}
                <code className="rounded bg-surface-3 px-1 py-0.5 text-[10px]">src/app/globals.css</code>
                . Ubah di sana untuk mengganti brand seluruh aplikasi.
              </p>
            </div>
          </CardBody>
        </Card>

        {/* --- Info --- */}
        <Card className="dp-rise col-span-12 xl:col-span-6">
          <CardHeader title="Penyimpanan" subtitle="Ringkasan isi database lokal" />
          <CardBody className="pt-2">
            <dl className="space-y-2.5">
              <InfoRow label="Transaksi" value={`${transactions.length} catatan`} />
              <InfoRow label="Kategori dianggarkan" value={`${budgets.length} kategori`} />
              <InfoRow label="Target tabungan" value={`${goals.length} target`} />
              <InfoRow label="Ukuran data" value={`${(bytes / 1024).toFixed(1)} KB`} />
              <InfoRow label="Kunci localStorage" value={STORAGE_KEY} mono />
            </dl>

            <div className="mt-4 flex items-start gap-2.5 rounded-xl bg-surface-2 p-3">
              <Info className="mt-0.5 size-4 shrink-0 text-ink-faint" />
              <p className="text-[11px] leading-relaxed text-ink-muted">
                Menghapus cache browser akan menghapus data ini. Ambil Backup JSON secara berkala,
                terutama sebelum ganti browser atau ganti HP.
              </p>
            </div>
          </CardBody>
        </Card>
      </div>

      <p className="flex items-center justify-center gap-2 pb-2 text-[11px] text-ink-faint">
        <Database className="size-3.5" />
        Dompet v1.1.0 · Personal Finance Dashboard · Data lokal, tanpa server
      </p>

      <ConfirmDialog
        open={confirm === "clear"}
        onClose={() => setConfirm(null)}
        onConfirm={() => {
          actions.clearAll();
          toast.success("Semua data dihapus");
        }}
        title="Hapus semua data?"
        description="Transaksi, anggaran, dan target tabungan akan hilang permanen. Pastikan kamu sudah mengambil backup JSON."
        confirmLabel="Hapus semua"
      />

      <ConfirmDialog
        open={confirm === "demo"}
        onClose={() => setConfirm(null)}
        onConfirm={() => {
          actions.loadDemoData();
          toast.success("Data demo dimuat ulang");
        }}
        title="Muat ulang data demo?"
        description="Data kamu saat ini akan diganti dengan dataset contoh 6 bulan."
        confirmLabel="Muat demo"
        destructive={false}
      />
    </div>
  );
}

function InfoRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-line pb-2.5 last:border-0 last:pb-0">
      <dt className="text-xs text-ink-muted">{label}</dt>
      <dd className={`truncate text-xs font-bold text-ink ${mono ? "font-mono text-[10px]" : ""}`}>
        {value}
      </dd>
    </div>
  );
}

function ToggleRow({
  icon,
  title,
  description,
  checked,
  onChange,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-line p-3 transition-colors duration-200 hover:bg-surface-2">
      <span className="mt-0.5 text-ink-faint">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-ink">{title}</span>
        <span className="mt-0.5 block text-[11px] leading-relaxed text-ink-muted">{description}</span>
      </span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="peer sr-only"
      />
      <span
        aria-hidden
        className="relative mt-0.5 h-6 w-11 shrink-0 rounded-full bg-surface-3 transition-colors duration-200 peer-checked:bg-brand peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[var(--ring)]"
      >
        <span
          className={`absolute top-0.5 size-5 rounded-full bg-surface shadow-sm transition-all duration-200 ${
            checked ? "left-[22px]" : "left-0.5"
          }`}
        />
      </span>
    </label>
  );
}
