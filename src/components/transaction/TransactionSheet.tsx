"use client";

import { Trash2 } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/cn";
import { categoriesOfType } from "@/lib/categories";
import { formatIDR, todayISO } from "@/lib/format";
import { actions } from "@/lib/store";
import type { Transaction, TxType } from "@/lib/types";
import { Button } from "@/components/ui/Button";
import { AmountInput, Field, Input, QuickAmounts } from "@/components/ui/Field";
import { ConfirmDialog } from "@/components/ui/Feedback";
import { Segmented } from "@/components/ui/Segmented";
import { Sheet } from "@/components/ui/Sheet";
import { useToast } from "@/components/ui/Toast";

const QUICK = [10_000, 25_000, 50_000, 100_000, 250_000];

interface FormState {
  type: TxType;
  amount: number;
  categoryId: string;
  note: string;
  date: string;
}

function initialForm(editing: Transaction | null): FormState {
  if (editing) {
    const { type, amount, categoryId, note, date } = editing;
    return { type, amount, categoryId, note, date };
  }
  return { type: "out", amount: 0, categoryId: "makanan", note: "", date: todayISO() };
}

/** Quick-input bottom sheet from PRD §3A: nominal, in/out, kategori, catatan, tanggal. */
export function TransactionSheet({
  onClose,
  editing,
}: {
  onClose: () => void;
  editing: Transaction | null;
}) {
  const toast = useToast();
  const [form, setForm] = useState<FormState>(() => initialForm(editing));
  const [touched, setTouched] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const categories = categoriesOfType(form.type);
  const amountError = touched && form.amount <= 0 ? "Nominal harus lebih dari 0." : undefined;
  const isEdit = Boolean(editing);

  function patch(next: Partial<FormState>) {
    setForm((f) => ({ ...f, ...next }));
  }

  function switchType(type: TxType) {
    // Keep a valid category when flipping between income and expense.
    const first = categoriesOfType(type)[0]?.id ?? "lainnya";
    patch({ type, categoryId: first });
  }

  function submit() {
    setTouched(true);
    if (form.amount <= 0) return;

    const payload = {
      type: form.type,
      amount: form.amount,
      categoryId: form.categoryId,
      note: form.note.trim(),
      date: form.date,
    };

    if (editing) {
      actions.updateTransaction(editing.id, payload);
      toast.success("Transaksi diperbarui");
    } else {
      actions.addTransaction(payload);
      toast.success(
        `${form.type === "in" ? "Pemasukan" : "Pengeluaran"} ${formatIDR(form.amount)} dicatat`,
      );
    }
    onClose();
  }

  function remove() {
    if (!editing) return;
    const snapshot = editing;
    actions.deleteTransaction(snapshot.id);
    onClose();
    toast.show("Transaksi dihapus", {
      tone: "success",
      action: { label: "Urungkan", onClick: () => actions.restoreTransaction(snapshot) },
    });
  }

  return (
    <>
      <Sheet
        open
        onClose={onClose}
        title={isEdit ? "Edit Transaksi" : "Catat Transaksi"}
        description={isEdit ? "Perbarui detail catatan ini." : "Isi nominal dulu, sisanya opsional."}
        footer={
          <div className="flex gap-3">
            {isEdit ? (
              <Button
                variant="secondary"
                size="lg"
                aria-label="Hapus transaksi"
                onClick={() => setConfirmDelete(true)}
                className="w-12 shrink-0 px-0 text-danger"
              >
                <Trash2 className="size-[18px]" />
              </Button>
            ) : null}
            <Button size="lg" className="flex-1" onClick={submit}>
              {isEdit ? "Simpan Perubahan" : "Simpan Transaksi"}
            </Button>
          </div>
        }
      >
        <div className="space-y-5 pb-4">
          <Segmented
            name="Tipe transaksi"
            value={form.type}
            onChange={switchType}
            options={[
              { value: "out", label: "Pengeluaran", colorVar: "--danger" },
              { value: "in", label: "Pemasukan", colorVar: "--success" },
            ]}
          />

          <Field label="Nominal" error={amountError}>
            <AmountInput
              value={form.amount}
              onValueChange={(amount) => patch({ amount })}
              autoFocus={!isEdit}
            />
          </Field>

          <QuickAmounts values={QUICK} onPick={(v) => patch({ amount: form.amount + v })} />

          <Field label="Kategori">
            <div className="grid grid-cols-4 gap-2">
              {categories.map((cat) => {
                const active = cat.id === form.categoryId;
                const Icon = cat.icon;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => patch({ categoryId: cat.id })}
                    aria-pressed={active}
                    className={cn(
                      "flex cursor-pointer flex-col items-center gap-1.5 rounded-xl border p-2.5",
                      "transition-all duration-200 ease-out active:scale-95",
                      active
                        ? "border-transparent shadow-soft"
                        : "border-line bg-surface-2 hover:border-line-strong",
                    )}
                    style={
                      active
                        ? {
                            background: `color-mix(in oklab, var(${cat.colorVar}) 16%, var(--surface))`,
                            borderColor: `var(${cat.colorVar})`,
                          }
                        : undefined
                    }
                  >
                    <Icon
                      className="size-[18px]"
                      style={{ color: active ? `var(${cat.colorVar})` : "var(--ink-faint)" }}
                    />
                    <span
                      className={cn(
                        "line-clamp-2 text-center text-[10px] font-semibold leading-tight",
                        active ? "text-ink" : "text-ink-muted",
                      )}
                    >
                      {cat.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </Field>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Tanggal" htmlFor="tx-date">
              <Input
                id="tx-date"
                type="date"
                value={form.date}
                max={todayISO()}
                onChange={(e) => patch({ date: e.target.value })}
              />
            </Field>
            <Field label="Catatan" htmlFor="tx-note" hint="Opsional">
              <Input
                id="tx-note"
                value={form.note}
                placeholder="mis. Kopi pagi"
                maxLength={80}
                onChange={(e) => patch({ note: e.target.value })}
              />
            </Field>
          </div>
        </div>
      </Sheet>

      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={remove}
        title="Hapus transaksi ini?"
        description="Catatan akan dihapus dari riwayat. Kamu masih bisa mengurungkan sesaat setelahnya."
      />
    </>
  );
}
