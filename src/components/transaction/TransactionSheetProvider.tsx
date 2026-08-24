"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import type { Transaction } from "@/lib/types";
import { TransactionSheet } from "./TransactionSheet";

interface SheetApi {
  /** Call with no argument to create, or with a transaction to edit it. */
  open: (tx?: Transaction) => void;
  close: () => void;
}

const Ctx = createContext<SheetApi | null>(null);

export function TransactionSheetProvider({ children }: { children: ReactNode }) {
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [open, setOpen] = useState(false);

  const api = useMemo<SheetApi>(
    () => ({
      open: (tx) => {
        setEditing(tx ?? null);
        setOpen(true);
      },
      close: () => setOpen(false),
    }),
    [],
  );

  const handleClose = useCallback(() => setOpen(false), []);

  return (
    <Ctx.Provider value={api}>
      {children}
      {/* Mounted only while open, and keyed per record, so the form state
          initialises from props instead of needing a reset effect. */}
      {open ? (
        <TransactionSheet key={editing?.id ?? "new"} onClose={handleClose} editing={editing} />
      ) : null}
    </Ctx.Provider>
  );
}

export function useTransactionSheet(): SheetApi {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useTransactionSheet must be used inside <TransactionSheetProvider>");
  return ctx;
}
