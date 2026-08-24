import {
  Banknote,
  Bus,
  Clapperboard,
  Gift,
  GraduationCap,
  HeartPulse,
  Laptop,
  MoreHorizontal,
  Receipt,
  ShoppingBag,
  TrendingUp,
  Utensils,
  type LucideIcon,
} from "lucide-react";
import type { TxType } from "./types";

export interface Category {
  id: string;
  label: string;
  type: TxType;
  icon: LucideIcon;
  /** CSS custom property holding this category's chart colour. */
  colorVar: string;
}

/**
 * Add a category by appending to this array — every chart, filter, picker and
 * budget row reads from it. See CUSTOMIZATION.md.
 */
export const CATEGORIES: Category[] = [
  // ---- Pengeluaran ----
  { id: "makanan", label: "Makanan & Minum", type: "out", icon: Utensils, colorVar: "--cat-1" },
  { id: "transport", label: "Transportasi", type: "out", icon: Bus, colorVar: "--cat-2" },
  { id: "tagihan", label: "Tagihan & Utilitas", type: "out", icon: Receipt, colorVar: "--cat-3" },
  { id: "hiburan", label: "Hiburan", type: "out", icon: Clapperboard, colorVar: "--cat-4" },
  { id: "belanja", label: "Belanja", type: "out", icon: ShoppingBag, colorVar: "--cat-5" },
  { id: "kesehatan", label: "Kesehatan", type: "out", icon: HeartPulse, colorVar: "--cat-6" },
  { id: "pendidikan", label: "Pendidikan", type: "out", icon: GraduationCap, colorVar: "--cat-7" },
  { id: "lainnya", label: "Lainnya", type: "out", icon: MoreHorizontal, colorVar: "--cat-8" },

  // ---- Pemasukan ----
  { id: "gaji", label: "Gaji", type: "in", icon: Banknote, colorVar: "--cat-3" },
  { id: "freelance", label: "Freelance", type: "in", icon: Laptop, colorVar: "--cat-4" },
  { id: "bonus", label: "Bonus & THR", type: "in", icon: TrendingUp, colorVar: "--cat-6" },
  { id: "hadiah", label: "Hadiah", type: "in", icon: Gift, colorVar: "--cat-5" },
  { id: "lain-masuk", label: "Lainnya", type: "in", icon: MoreHorizontal, colorVar: "--cat-8" },
];

const BY_ID = new Map(CATEGORIES.map((c) => [c.id, c]));

const FALLBACK: Category = {
  id: "lainnya",
  label: "Lainnya",
  type: "out",
  icon: MoreHorizontal,
  colorVar: "--cat-8",
};

export function getCategory(id: string): Category {
  return BY_ID.get(id) ?? FALLBACK;
}

export function categoriesOfType(type: TxType): Category[] {
  return CATEGORIES.filter((c) => c.type === type);
}

export const EXPENSE_CATEGORIES = categoriesOfType("out");

