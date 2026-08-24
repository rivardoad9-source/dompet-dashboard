"use client";

import { Trash2 } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/cn";
import { formatDateHuman, formatIDR, monthsUntil, todayISO, toISO } from "@/lib/format";
import { goalProgress } from "@/lib/stats";
import { actions } from "@/lib/store";
import type { Goal } from "@/lib/types";
import { Button } from "@/components/ui/Button";
import { AmountInput, Field, Input, QuickAmounts } from "@/components/ui/Field";
import { ConfirmDialog, EmptyState } from "@/components/ui/Feedback";
import { Sheet } from "@/components/ui/Sheet";
import { useToast } from "@/components/ui/Toast";
import { Receipt } from "lucide-react";

const GOAL_COLORS = ["--cat-1", "--cat-3", "--cat-4", "--cat-5", "--cat-6", "--cat-7"];

function defaultDeadline() {
  const d = new Date();
  return toISO(new Date(d.getFullYear(), d.getMonth() + 12, 1));
}

/** Create or edit a savings target. */
export function GoalEditorSheet({
  goal,
  onClose,
}: {
  /** `null` means "create new". */
  goal: Goal | null;
  onClose: () => void;
}) {
  const toast = useToast();
  const [name, setName] = useState(goal?.name ?? "");
  const [target, setTarget] = useState(goal?.target ?? 0);
  const [deadline, setDeadline] = useState(goal?.deadline || defaultDeadline());
  const [colorVar, setColorVar] = useState(goal?.colorVar ?? GOAL_COLORS[0]);
  const [touched, setTouched] = useState(false);

  const nameError = touched && !name.trim() ? "Nama target wajib diisi." : undefined;
  const targetError = touched && target <= 0 ? "Target harus lebih dari 0." : undefined;
  const months = deadline ? monthsUntil(deadline) : 0;
  const suggested = months > 0 && target > 0 ? Math.ceil(target / months / 50_000) * 50_000 : 0;

  function save() {
    setTouched(true);
    if (!name.trim() || target <= 0) return;

    if (goal) {
      actions.updateGoal(goal.id, { name: name.trim(), target, deadline, colorVar });
      toast.success("Target diperbarui");
    } else {
      actions.addGoal({ name: name.trim(), target, deadline, colorVar });
      toast.success(`Target "${name.trim()}" dibuat`);
    }
    onClose();
  }

  return (
    <Sheet
      open
      onClose={onClose}
      title={goal ? "Edit Target" : "Target Baru"}
      description={goal ? "Ubah nama, nominal, atau tenggat." : "Mau nabung untuk apa?"}
      footer={
        <Button size="lg" className="w-full" onClick={save}>
          {goal ? "Simpan Perubahan" : "Buat Target"}
        </Button>
      }
    >
      <div className="space-y-5 pb-4">
        <Field label="Nama target" htmlFor="goal-name" error={nameError}>
          <Input
            id="goal-name"
            value={name}
            maxLength={40}
            autoFocus={!goal}
            placeholder="mis. Dana Darurat"
            onChange={(e) => setName(e.target.value)}
          />
        </Field>

        <Field label="Target nominal" error={targetError}>
          <AmountInput value={target} onValueChange={setTarget} />
        </Field>

        <QuickAmounts values={[1_000_000, 5_000_000, 10_000_000]} onPick={(v) => setTarget(target + v)} />

        <Field
          label="Target tercapai pada"
          htmlFor="goal-deadline"
          hint={
            suggested > 0
              ? `Perlu sekitar ${formatIDR(suggested)} / bulan selama ${months} bulan.`
              : "Opsional, tapi bikin kalkulator setoran jadi akurat."
          }
        >
          <Input
            id="goal-deadline"
            type="date"
            value={deadline}
            min={todayISO()}
            onChange={(e) => setDeadline(e.target.value)}
          />
        </Field>

        <Field label="Warna">
          <div className="flex gap-2">
            {GOAL_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                aria-label={`Pilih warna ${c.replace("--cat-", "")}`}
                aria-pressed={c === colorVar}
                onClick={() => setColorVar(c)}
                className={cn(
                  "size-9 cursor-pointer rounded-xl transition-all duration-200",
                  c === colorVar ? "ring-2 ring-offset-2" : "opacity-60 hover:opacity-100",
                )}
                style={
                  {
                    background: `var(${c})`,
                    "--tw-ring-color": `var(${c})`,
                    "--tw-ring-offset-color": "var(--surface)",
                  } as React.CSSProperties
                }
              />
            ))}
          </div>
        </Field>
      </div>
    </Sheet>
  );
}

/** Record money moved into a goal. */
export function DepositSheet({ goal, onClose }: { goal: Goal; onClose: () => void }) {
  const toast = useToast();
  const p = goalProgress(goal);
  const [amount, setAmount] = useState(p.suggested || 0);
  const [date, setDate] = useState(todayISO());
  const [note, setNote] = useState("");

  function save() {
    if (amount <= 0) return;
    actions.addDeposit(goal.id, { amount, date, note: note.trim() });
    toast.success(`${formatIDR(amount)} masuk ke ${goal.name}`);
    onClose();
  }

  return (
    <Sheet
      open
      onClose={onClose}
      title={`Setor ke ${goal.name}`}
      description={`Kurang ${formatIDR(p.remaining)} lagi untuk mencapai target.`}
      footer={
        <Button size="lg" className="w-full" onClick={save} disabled={amount <= 0}>
          Simpan Setoran
        </Button>
      }
    >
      <div className="space-y-5 pb-4">
        <Field
          label="Nominal setoran"
          hint={p.suggested > 0 ? `Rekomendasi bulanan: ${formatIDR(p.suggested)}` : undefined}
        >
          <AmountInput value={amount} onValueChange={setAmount} autoFocus />
        </Field>

        <QuickAmounts values={[100_000, 250_000, 500_000, 1_000_000]} onPick={(v) => setAmount(amount + v)} />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Tanggal" htmlFor="dep-date">
            <Input
              id="dep-date"
              type="date"
              value={date}
              max={todayISO()}
              onChange={(e) => setDate(e.target.value)}
            />
          </Field>
          <Field label="Catatan" htmlFor="dep-note" hint="Opsional">
            <Input
              id="dep-note"
              value={note}
              maxLength={60}
              placeholder="mis. Sisa gaji"
              onChange={(e) => setNote(e.target.value)}
            />
          </Field>
        </div>
      </div>
    </Sheet>
  );
}

/** Deposit history for one goal, with per-row delete and goal removal. */
export function GoalHistorySheet({ goal, onClose }: { goal: Goal; onClose: () => void }) {
  const toast = useToast();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const rows = [...goal.deposits].sort((a, b) => b.date.localeCompare(a.date));

  return (
    <>
      <Sheet
        open
        onClose={onClose}
        title={`Riwayat ${goal.name}`}
        description={`${rows.length} setoran tercatat`}
        footer={
          <Button variant="secondary" size="lg" className="w-full text-danger" onClick={() => setConfirmDelete(true)}>
            <Trash2 className="size-[18px]" />
            Hapus target ini
          </Button>
        }
      >
        <div className="pb-4">
          {rows.length ? (
            <ul className="-mx-2 space-y-0.5">
              {rows.map((d) => (
                <li
                  key={d.id}
                  className="flex items-center gap-3 rounded-xl px-2 py-2.5 transition-colors duration-200 hover:bg-surface-2"
                >
                  <span
                    className="size-2.5 shrink-0 rounded-full"
                    style={{ background: `var(${goal.colorVar})` }}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-ink">
                      {d.note || "Setoran"}
                    </span>
                    <span className="block text-xs text-ink-muted">{formatDateHuman(d.date)}</span>
                  </span>
                  <span className="shrink-0 text-sm font-extrabold tabular-nums text-ink">
                    {formatIDR(d.amount)}
                  </span>
                  <button
                    type="button"
                    aria-label={`Hapus setoran ${formatIDR(d.amount)}`}
                    onClick={() => {
                      actions.deleteDeposit(goal.id, d.id);
                      toast.success("Setoran dihapus");
                    }}
                    className="shrink-0 cursor-pointer rounded-lg p-2 text-ink-faint transition-colors duration-200 hover:bg-danger-soft hover:text-danger"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState
              icon={Receipt}
              title="Belum ada setoran"
              description="Setoran pertamamu akan muncul di sini."
            />
          )}
        </div>
      </Sheet>

      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={() => {
          actions.deleteGoal(goal.id);
          toast.success("Target dihapus");
          onClose();
        }}
        title={`Hapus "${goal.name}"?`}
        description="Semua riwayat setoran target ini ikut terhapus dan tidak bisa dikembalikan."
        confirmLabel="Hapus target"
      />
    </>
  );
}
