import { History, LayoutGrid, PiggyBank, Settings, Wallet, type LucideIcon } from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** PRD: the bottom bar carries exactly four primary tabs. */
  primary: boolean;
}

export const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Beranda", icon: LayoutGrid, primary: true },
  { href: "/anggaran", label: "Anggaran", icon: Wallet, primary: true },
  { href: "/tabungan", label: "Tabungan", icon: PiggyBank, primary: true },
  { href: "/riwayat", label: "Riwayat", icon: History, primary: true },
  { href: "/pengaturan", label: "Pengaturan", icon: Settings, primary: false },
];

export const PRIMARY_NAV = NAV_ITEMS.filter((i) => i.primary);

export function isActivePath(pathname: string, href: string): boolean {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

export function pageTitle(pathname: string): string {
  return NAV_ITEMS.find((i) => isActivePath(pathname, i.href))?.label ?? "Dompet";
}
