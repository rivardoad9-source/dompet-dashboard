"use client";

import { ArrowRight } from "lucide-react";
import Link from "next/link";
import type { Transaction } from "@/lib/types";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { TransactionList } from "@/components/transaction/TransactionList";

/** "Aktivitas Terkini" (PRD §3A) — the last five entries, tap to edit. */
export function RecentActivityCard({
  transactions,
  privacy,
  limit = 5,
}: {
  transactions: Transaction[];
  privacy: boolean;
  limit?: number;
}) {
  const recent = [...transactions]
    .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt)
    .slice(0, limit);

  return (
    <Card className="dp-rise flex h-full flex-col">
      <CardHeader
        title="Aktivitas Terkini"
        subtitle={`${limit} transaksi terakhir`}
        action={
          <Link
            href="/riwayat"
            className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-bold text-brand transition-colors duration-200 hover:bg-brand-soft"
          >
            Semua
            <ArrowRight className="size-3.5" />
          </Link>
        }
      />
      <CardBody className="flex-1 pt-2">
        <TransactionList transactions={recent} privacy={privacy} />
      </CardBody>
    </Card>
  );
}
