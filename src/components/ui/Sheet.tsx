"use client";

import { X } from "lucide-react";
import { useEffect, useId, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/cn";
import { IconButton } from "./Button";

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * One component, two presentations: a bottom sheet on phones (per the PRD's
 * "bottom sheet modal") and a centred dialog from `sm` up.
 */
export function Sheet({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = "md",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  size?: "md" | "lg";
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const restoreFocusTo = useRef<HTMLElement | null>(null);
  const titleId = useId();
  const descId = useId();

  useEffect(() => {
    if (!open) return;

    restoreFocusTo.current = document.activeElement as HTMLElement | null;
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";

    const panel = panelRef.current;
    panel?.querySelector<HTMLElement>(FOCUSABLE)?.focus();

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key !== "Tab" || !panel) return;
      // Keep Tab inside the dialog while it's open.
      const items = [...panel.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
        (el) => el.offsetParent !== null,
      );
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = overflow;
      restoreFocusTo.current?.focus?.();
    };
  }, [open, onClose]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6">
      <button
        type="button"
        aria-label="Tutup"
        onClick={onClose}
        className="dp-scrim absolute inset-0 cursor-default"
        style={{ background: "var(--sheet-scrim)" }}
        tabIndex={-1}
      />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descId : undefined}
        className={cn(
          "dp-sheet relative flex max-h-[92dvh] w-full flex-col overflow-hidden bg-surface shadow-float",
          "rounded-t-[28px] sm:rounded-card",
          size === "lg" ? "sm:max-w-2xl" : "sm:max-w-md",
        )}
      >
        {/* Grab handle — a familiar affordance that this panel dismisses downward. */}
        <div className="flex justify-center pt-3 sm:hidden">
          <span aria-hidden className="h-1.5 w-11 rounded-full bg-line-strong" />
        </div>

        <header className="flex items-start justify-between gap-3 px-5 pb-3 pt-4">
          <div className="min-w-0">
            <h2 id={titleId} className="text-lg font-extrabold tracking-tight text-ink">
              {title}
            </h2>
            {description ? (
              <p id={descId} className="mt-1 text-sm text-ink-muted">
                {description}
              </p>
            ) : null}
          </div>
          <IconButton label="Tutup" onClick={onClose} className="-mr-1 -mt-1">
            <X className="size-5" />
          </IconButton>
        </header>

        <div className="dp-no-scrollbar min-h-0 flex-1 overflow-y-auto px-5 pb-2">{children}</div>

        {footer ? (
          <footer className="dp-safe-bottom border-t border-line bg-surface px-5 py-4">{footer}</footer>
        ) : (
          <div className="dp-safe-bottom pb-4" />
        )}
      </div>
    </div>,
    document.body,
  );
}
