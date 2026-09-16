"use client";

import { AlertTriangle, CheckCircle2, Info, X } from "lucide-react";
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { useMounted } from "@/lib/hooks";

type ToastTone = "success" | "error" | "info";

interface ToastAction {
  label: string;
  onClick: () => void;
}

interface Toast {
  id: number;
  message: string;
  tone: ToastTone;
  action?: ToastAction;
}

interface ToastApi {
  show: (message: string, options?: { tone?: ToastTone; action?: ToastAction; duration?: number }) => void;
  success: (message: string, action?: ToastAction) => void;
  error: (message: string) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

const ICONS: Record<ToastTone, typeof Info> = {
  success: CheckCircle2,
  error: AlertTriangle,
  info: Info,
};

const TONE_VAR: Record<ToastTone, string> = {
  success: "--success",
  error: "--danger",
  info: "--brand",
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const mounted = useMounted();
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => {
    setToasts((list) => list.filter((t) => t.id !== id));
  }, []);

  const show = useCallback<ToastApi["show"]>(
    (message, options) => {
      const id = nextId.current++;
      const toast: Toast = { id, message, tone: options?.tone ?? "info", action: options?.action };
      // Cap at three so a burst of actions can't bury the screen.
      setToasts((list) => [...list.slice(-2), toast]);
      window.setTimeout(() => dismiss(id), options?.duration ?? (options?.action ? 6000 : 3200));
    },
    [dismiss],
  );

  const api = useMemo<ToastApi>(
    () => ({
      show,
      success: (message, action) => show(message, { tone: "success", action }),
      error: (message) => show(message, { tone: "error" }),
    }),
    [show],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      {mounted
        ? createPortal(
            <div
              aria-live="polite"
              aria-atomic="false"
              className="dp-safe-bottom pointer-events-none fixed inset-x-0 bottom-0 z-[60] flex flex-col items-center gap-2 px-4 pb-24 sm:items-end sm:px-6 sm:pb-6 lg:pb-6"
            >
              {toasts.map((t) => {
                const Icon = ICONS[t.tone];
                return (
                  <div
                    key={t.id}
                    role="status"
                    className="dp-panel dp-pop pointer-events-auto flex w-full max-w-sm items-center gap-3 rounded-2xl border border-line bg-surface px-4 py-3 shadow-float"
                  >
                    <Icon className="size-5 shrink-0" style={{ color: `var(${TONE_VAR[t.tone]})` }} />
                    <p className="min-w-0 flex-1 text-sm font-medium text-ink">{t.message}</p>
                    {t.action ? (
                      <button
                        type="button"
                        onClick={() => {
                          t.action?.onClick();
                          dismiss(t.id);
                        }}
                        className="shrink-0 cursor-pointer rounded-lg px-2 py-1 text-xs font-bold text-brand transition-colors duration-200 hover:bg-brand-soft"
                      >
                        {t.action.label}
                      </button>
                    ) : null}
                    <button
                      type="button"
                      aria-label="Tutup notifikasi"
                      onClick={() => dismiss(t.id)}
                      className="shrink-0 cursor-pointer rounded-lg p-1 text-ink-faint transition-colors duration-200 hover:bg-surface-2 hover:text-ink"
                    >
                      <X className="size-4" />
                    </button>
                  </div>
                );
              })}
            </div>,
            document.body,
          )
        : null}
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider>");
  return ctx;
}
