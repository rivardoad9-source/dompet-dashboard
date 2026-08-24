"use client";

import { Trash2 } from "lucide-react";
import { useState } from "react";
import { getCategory } from "@/lib/categories";
import { formatIDR } from "@/lib/format";
import { actions } from "@/lib/store";
import { Button } from "@/components/ui/Button";
import { AmountInput, Field, QuickAmounts } from "@/components/ui/Field";
import { Sheet } from "@/components/ui/Sheet";
import { useToast } from "@/components/ui/Toast";

const QUICK = [100_000, 250_000, 500_000, 1_000_000];

/** Set or clear the monthly ceiling for one expense category. */
export function BudgetEditorSheet({
  categoryId,
  currentLimit,
  spent,
  onClose,
  allowRemove = true,
}: {
  categoryId: string | null;
  currentLimit: number;
  spent: number;
  onClose: () => void;
  allowRemove?: boolean;
}) {
  const toast = useToast();
  // The caller mounts this sheet fresh per category, so the initial value is
  // always current — no reset effect needed.
  const [limit, setLimit] = useState(currentLimit);

  if (!categoryId) return null;
  const cat = getCategory(categoryId);

  function save() {
    if (!categoryId) return;
    actions.setBudget(categoryId, limit);
    toast.success(`Plafon ${cat.label} disetel ke ${formatIDR(limit)}`);
    onClose();
  }

  function remove() {
    if (!categoryId) return;
    actions.removeBudget(categoryId);
    toast.success(`Anggaran ${cat.label} dihapus`);
    onClose();
  }

  return (
    <Sheet
      open
      onClose={onClose}
      title={`Plafon ${cat.label}`}
      description={`Terpakai bulan ini: ${formatIDR(spent)}`}
      footer={
        <div className="flex gap-3">
          {allowRemove ? (
            <Button
              variant="secondary"
              size="lg"
              aria-label="Hapus anggaran kategori"
              onClick={remove}
              className="w-12 shrink-0 px-0 text-danger"
            >
              <Trash2 className="size-[18px]" />
            </Button>
          ) : null}
          <Button size="lg" className="flex-1" onClick={save} disabled={limit <= 0}>
            Simpan Plafon
          </Button>
        </div>
      }
    >
      <div className="space-y-5 pb-4">
        <Field
          label="Batas pengeluaran per bulan"
          hint={
            spent > 0 && limit > 0
              ? `Dengan plafon ini, realisasi saat ini = ${Math.round((spent / limit) * 100)}%`
              : "Sisakan ruang untuk pengeluaran tak terduga."
          }
        >
          <AmountInput value={limit} onValueChange={setLimit} autoFocus />
        </Field>
        <QuickAmounts values={QUICK} onPick={(v) => setLimit(limit + v)} />
      </div>
    </Sheet>
  );
}
