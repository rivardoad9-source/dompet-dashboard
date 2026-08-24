import Link from "next/link";
import { cn } from "@/lib/cn";

/** Inline SVG mark — no image request, and it recolours with the theme. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "grid size-9 shrink-0 place-items-center rounded-xl bg-brand text-on-brand",
        className,
      )}
    >
      <svg viewBox="0 0 24 24" fill="none" className="size-5" aria-hidden>
        <path
          d="M4 8.5A2.5 2.5 0 0 1 6.5 6h11A2.5 2.5 0 0 1 20 8.5v9a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 17.5v-9Z"
          stroke="currentColor"
          strokeWidth="1.9"
        />
        <path d="M4 10.5h13a2 2 0 0 1 0 4H4" stroke="currentColor" strokeWidth="1.9" />
        <path d="M7 6V5a2 2 0 0 1 2.6-1.9l7 2.2" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
        <circle cx="16.5" cy="12.5" r="1.15" fill="currentColor" />
      </svg>
    </span>
  );
}

export function Logo({ href = "/", className }: { href?: string; className?: string }) {
  return (
    <Link
      href={href}
      className={cn("group inline-flex items-center gap-2.5", className)}
      aria-label="Dompet — ke Beranda"
    >
      <LogoMark className="transition-transform duration-200 group-hover:scale-105" />
      <span className="leading-tight">
        <span className="block text-[17px] font-extrabold tracking-tight text-ink">Dompet</span>
        <span className="block text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-faint">
          Personal Finance
        </span>
      </span>
    </Link>
  );
}
