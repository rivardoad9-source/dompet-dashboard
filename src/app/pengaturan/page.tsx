"use client";

import {
  Database,
  Download,
  Eye,
  FileJson,
  ImagePlus,
  Info,
  Moon,
  Palette,
  RotateCcw,
  Share2,
  ShieldAlert,
  ShieldCheck,
  Smartphone,
  Trash2,
  Undo2,
  Upload,
  User,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { BACKUP_REMINDER_AFTER } from "@/lib/config";
import {
  checkPersistence,
  estimateStorage,
  readMeta,
  readUndo,
  requestPersistence,
  type PersistenceState,
  type StorageMeta,
  type StorageUsage,
  type UndoSnapshot,
} from "@/lib/durability";
import { exportBackupJson, readBackupFile, shareBackupJson } from "@/lib/export";
import { monthKey } from "@/lib/format";
import { HERO_METRICS } from "@/lib/hero-metrics";
import { STORAGE_KEY, actions, useStore } from "@/lib/store";
import type { HeroMetric } from "@/lib/types";
import { PageIntro } from "@/components/shell/AppShell";
import { AvatarCropSheet } from "@/components/shell/AvatarCropSheet";
import { ExportSheet } from "@/components/export/ExportSheet";
import { ImportSheet } from "@/components/export/ImportSheet";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { ConfirmDialog, Skeleton } from "@/components/ui/Feedback";
import { Field, Input, Select } from "@/components/ui/Field";
import { Segmented } from "@/components/ui/Segmented";
import { useToast } from "@/components/ui/Toast";

export default function PengaturanPage() {
  const { state, hydrated } = useStore();
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const avatarRef = useRef<HTMLInputElement>(null);
  const [cropping, setCropping] = useState<File | null>(null);
  const [confirm, setConfirm] = useState<"clear" | "demo" | null>(null);
  const [sharing, setSharing] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);

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
    actions.replaceState(result.state, "Pulihkan dari backup");
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
                onClick={() => setImporting(true)}
              >
                <Upload className="size-4" />
                Impor Data
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
                  onClick={() => setExporting(true)}
                >
                  <Download className="size-4" />
                  Ekspor: PDF, Excel, gambar…
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
          <CardHeader title="Profil" subtitle="Foto dan nama yang muncul di sapaan beranda" />
          <CardBody className="space-y-4 pt-2">
            <div className="flex items-center gap-4">
              {settings.avatar ? (
                /* eslint-disable-next-line @next/next/no-img-element -- data URL lokal */
                <img
                  src={settings.avatar}
                  alt="Foto profil sekarang"
                  className="size-16 shrink-0 rounded-2xl object-cover"
                />
              ) : (
                <span className="grid size-16 shrink-0 place-items-center rounded-2xl bg-brand-soft text-lg font-extrabold text-brand">
                  {settings.name.trim().slice(0, 2).toUpperCase() || "DP"}
                </span>
              )}

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => avatarRef.current?.click()}
                  >
                    <ImagePlus className="size-4" />
                    {settings.avatar ? "Ganti foto" : "Pilih foto"}
                  </Button>
                  {settings.avatar ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        actions.setSettings({ avatar: "" });
                        toast.success("Foto profil dihapus");
                      }}
                    >
                      Hapus
                    </Button>
                  ) : null}
                </div>
                <p className="mt-2 text-[11px] leading-relaxed text-ink-muted">
                  Kamu yang menentukan bagian mana yang dipakai — geser dan atur zoom, lalu
                  disimpan sebagai persegi 128px (sekitar 8 KB).
                </p>
              </div>
            </div>

            <input
              ref={avatarRef}
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) setCropping(file);
                e.target.value = "";
              }}
            />

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
                  { value: "mono", label: "Mono" },
                  { value: "midnight", label: "Midnight" },
                  { value: "glass", label: "Glass" },
                ]}
              />
            </Field>

            <Field
              label="Angka utama di Beranda"
              htmlFor="hero-metric"
              hint="Bisa juga diganti dengan mengetuk labelnya langsung di kartu Beranda."
            >
              <Select
                id="hero-metric"
                value={settings.heroMetric}
                onChange={(e) => actions.setSettings({ heroMetric: e.target.value as HeroMetric })}
              >
                {HERO_METRICS.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label}
                  </option>
                ))}
              </Select>
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

        {/* --- Keamanan data --- */}
        <DataSafetyCard
          transactions={transactions.length}
          budgets={budgets.length}
          goals={goals.length}
          bytes={bytes}
        />
      </div>

      <p className="flex items-center justify-center gap-2 pb-2 text-[11px] text-ink-faint">
        <Database className="size-3.5" />
        Dompet v1.1.0 · Personal Finance Dashboard · Data lokal, tanpa server
      </p>

      <AvatarCropSheet
        file={cropping}
        onClose={() => setCropping(null)}
        onError={(message) => toast.error(message)}
        onSave={(dataUrl, bytes) => {
          actions.setSettings({ avatar: dataUrl });
          setCropping(null);
          toast.success(`Foto profil disimpan (${Math.max(1, Math.round(bytes / 1024))} KB)`);
        }}
      />

      <ImportSheet open={importing} onClose={() => setImporting(false)} />

      <ExportSheet
        open={exporting}
        onClose={() => setExporting(false)}
        transactions={transactions}
        monthKey={monthKey(new Date())}
        scopeLabel="Seluruh data"
      />

      <ConfirmDialog
        open={confirm === "clear"}
        onClose={() => setConfirm(null)}
        onConfirm={() => {
          const undoable = actions.clearAll();
          if (undoable) toast.success("Semua data dihapus — masih bisa diurungkan");
          else toast.error("Semua data dihapus, tapi cadangan urungkan gagal disimpan.");
        }}
        title="Hapus semua data?"
        description="Transaksi, anggaran, dan target tabungan akan dikosongkan. Keadaan sekarang disimpan sekali sebagai cadangan, jadi masih bisa diurungkan dari kartu Keamanan Data — tapi backup JSON tetap pengaman yang paling andal."
        confirmLabel="Hapus semua"
      />

      <ConfirmDialog
        open={confirm === "demo"}
        onClose={() => setConfirm(null)}
        onConfirm={() => {
          const undoable = actions.loadDemoData();
          if (undoable) toast.success("Data demo dimuat — masih bisa diurungkan");
          else toast.error("Data demo dimuat, tapi cadangan urungkan gagal disimpan.");
        }}
        title="Muat ulang data demo?"
        description="Data kamu saat ini akan diganti dengan dataset contoh 6 bulan."
        confirmLabel="Muat demo"
        destructive={false}
      />
    </div>
  );
}

/**
 * Kartu ketahanan data.
 *
 * Tanpa server, kehilangan data tidak bisa dipulihkan siapa pun — dan sekali
 * terjadi, pengguna tidak akan mempercayai aplikasi keuangan lagi. Kartu ini
 * membuat tiga hal yang biasanya tak terlihat menjadi terlihat: apakah browser
 * sudah berjanji tidak membuang data ini, berapa catatan yang belum ter-backup,
 * dan apakah masih ada tindakan merusak yang bisa diurungkan.
 */
function DataSafetyCard({
  transactions,
  budgets,
  goals,
  bytes,
}: {
  transactions: number;
  budgets: number;
  goals: number;
  bytes: number;
}) {
  const toast = useToast();
  const [persistence, setPersistence] = useState<PersistenceState | null>(null);
  const [usage, setUsage] = useState<StorageUsage | null>(null);
  const [asking, setAsking] = useState(false);
  // Dinaikkan setelah Urungkan, untuk kasus langka ketika jumlah data kembali
  // ke angka yang sama persis dan memo di bawah tidak akan terpicu sendiri.
  const [refresh, setRefresh] = useState(0);

  // Kartu ini hanya dirender setelah store terhidrasi, jadi membaca
  // localStorage saat render aman dan tidak pernah terjadi di server.
  const meta: StorageMeta = useMemo(
    () => readMeta(),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sumbernya localStorage; kunci ini yang menandakan isinya berubah
    [transactions, budgets, goals, refresh],
  );
  const undo: UndoSnapshot | null = useMemo(
    () => readUndo(),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- idem
    [transactions, budgets, goals, refresh],
  );

  // Status penyimpanan hanya tersedia lewat promise, jadi ini tetap efek.
  useEffect(() => {
    void checkPersistence().then(setPersistence);
    void estimateStorage().then(setUsage);
  }, [transactions, refresh]);

  const unbacked =
    meta.lastBackupAt === null ? transactions : Math.max(0, transactions - meta.transactionsAtBackup);

  const needsBackup = BACKUP_REMINDER_AFTER > 0 && unbacked >= BACKUP_REMINDER_AFTER;

  return (
    <Card className="dp-rise col-span-12 xl:col-span-6">
      <CardHeader title="Keamanan Data" subtitle="Ketahanan penyimpanan dan cadangan" />
      <CardBody className="space-y-4 pt-2">
        {/* Penyimpanan permanen: satu-satunya pengaman terhadap browser yang
            membuang data situs saat memori perangkat menipis. */}
        <div
          className="flex items-start gap-2.5 rounded-xl p-3"
          style={
            persistence === "granted"
              ? { background: "var(--success-soft)", color: "var(--success)" }
              : { background: "var(--warning-soft)", color: "var(--warning)" }
          }
        >
          {persistence === "granted" ? (
            <ShieldCheck className="mt-0.5 size-4 shrink-0" />
          ) : (
            <ShieldAlert className="mt-0.5 size-4 shrink-0" />
          )}
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold">
              {persistence === "granted"
                ? "Penyimpanan permanen aktif"
                : persistence === "unsupported"
                  ? "Browser ini tidak mendukung penyimpanan permanen"
                  : "Penyimpanan belum permanen"}
            </p>
            <p className="mt-1 text-[11px] leading-relaxed opacity-90">
              {persistence === "granted"
                ? "Browser tidak akan membuang data ini sendiri saat memori HP menipis. Hanya kamu yang bisa menghapusnya."
                : persistence === "unsupported"
                  ? "Ambil backup lebih sering, karena data bisa dibuang browser tanpa pemberitahuan."
                  : "Saat memori HP menipis, browser boleh menghapus data ini tanpa bertanya. Pasang aplikasi ke layar utama, lalu aktifkan."}
            </p>

            {persistence !== "granted" ? (
              <Button
                variant="secondary"
                size="sm"
                className="mt-2.5"
                disabled={asking || persistence === "unsupported"}
                onClick={async () => {
                  setAsking(true);
                  const result = await requestPersistence();
                  setPersistence(result);
                  setAsking(false);
                  if (result === "granted") toast.success("Penyimpanan permanen aktif");
                  else
                    toast.error(
                      "Browser belum mengabulkan. Pasang aplikasi ke layar utama, lalu coba lagi.",
                    );
                }}
              >
                <ShieldCheck className="size-4" />
                {asking ? "Meminta…" : "Aktifkan"}
              </Button>
            ) : null}
          </div>
        </div>

        {/* Pengingat backup. */}
        {needsBackup ? (
          <p
            className="rounded-xl px-3 py-2.5 text-[11px] font-medium leading-relaxed"
            style={{ background: "var(--warning-soft)", color: "var(--warning)" }}
          >
            <strong>{unbacked} transaksi belum masuk backup.</strong> Ketuk{" "}
            <em>Backup &amp; Kirim</em> di atas — filenya bisa langsung disimpan ke Drive atau
            dikirim ke diri sendiri lewat WhatsApp.
          </p>
        ) : null}

        {/* Urungkan tindakan merusak terakhir. */}
        {undo ? (
          <div className="rounded-xl border border-line p-3">
            <p className="text-[11px] leading-relaxed text-ink-muted">
              Tindakan terakhir: <strong className="text-ink">{undo.label}</strong>. Keadaan
              sebelumnya berisi {undo.transactions} transaksi dan masih bisa dikembalikan.
            </p>
            <Button
              variant="secondary"
              size="sm"
              className="mt-2.5"
              onClick={() => {
                const ok = actions.undoLast();
                setRefresh((n) => n + 1);
                if (ok) toast.success("Data sebelumnya dikembalikan");
                else toast.error("Tidak ada yang bisa diurungkan.");
              }}
            >
              <Undo2 className="size-4" />
              Urungkan
            </Button>
          </div>
        ) : null}

        <dl className="space-y-2.5">
          <InfoRow label="Transaksi" value={`${transactions} catatan`} />
          <InfoRow label="Kategori dianggarkan" value={`${budgets} kategori`} />
          <InfoRow label="Target tabungan" value={`${goals} target`} />
          <InfoRow label="Ukuran data" value={`${(bytes / 1024).toFixed(1)} KB`} />
          <InfoRow
            label="Backup terakhir"
            value={
              meta?.lastBackupAt
                ? new Date(meta.lastBackupAt).toLocaleString("id-ID", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })
                : "Belum pernah"
            }
          />
          {usage ? (
            <InfoRow
              label="Kuota terpakai"
              value={`${(usage.usedBytes / 1024 / 1024).toFixed(1)} MB dari ${(
                usage.quotaBytes /
                1024 /
                1024 /
                1024
              ).toFixed(1)} GB`}
            />
          ) : null}
          <InfoRow label="Kunci localStorage" value={STORAGE_KEY} mono />
        </dl>

        <div className="flex items-start gap-2.5 rounded-xl bg-surface-2 p-3">
          <Info className="mt-0.5 size-4 shrink-0 text-ink-faint" />
          <p className="text-[11px] leading-relaxed text-ink-muted">
            Penyimpanan permanen tidak melindungi dari <em>Hapus data situs</em> di pengaturan
            browser, dan tidak ikut berpindah saat ganti HP. Backup berkala tetap satu-satunya
            pemulihan yang berlaku di semua keadaan.
          </p>
        </div>
      </CardBody>
    </Card>
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
