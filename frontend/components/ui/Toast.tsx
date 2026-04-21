"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import {
  AlertOctagon,
  AlertTriangle,
  CircleCheck,
  type LucideIcon,
} from "@/components/icons";
import { DURATION_MICRO, DURATION_SHORT, EASE_OUT, SPRING_DEFAULT } from "@/lib/motion";

export type ToastKind = "success" | "error" | "info";

interface ToastInput {
  kind: ToastKind;
  text: string;
  ttlMs?: number;
}

interface Toast extends ToastInput {
  id: number;
  ttlMs: number;
}

interface ToastContextValue {
  push: (toast: ToastInput) => void;
  dismiss: (id: number) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const DEFAULT_TTL_MS = 6000;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const push = useCallback((input: ToastInput) => {
    const id = nextId.current++;
    const ttlMs = input.ttlMs ?? (input.kind === "error" ? 0 : DEFAULT_TTL_MS);
    setToasts((prev) => [...prev, { ...input, id, ttlMs }]);
  }, []);

  const value = useMemo<ToastContextValue>(() => ({ push, dismiss }), [push, dismiss]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastViewport toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used inside <ToastProvider>");
  }
  return ctx;
}

const toneStyles: Record<ToastKind, { wrapper: string; icon: LucideIcon; iconCls: string }> = {
  success: {
    wrapper: "border-verified/40 bg-surface-panel text-text",
    icon: CircleCheck,
    iconCls: "text-verified",
  },
  error: {
    wrapper: "border-severity-critical/50 bg-surface-panel text-text",
    icon: AlertOctagon,
    iconCls: "text-severity-critical",
  },
  info: {
    wrapper: "border-brand-600/50 bg-surface-panel text-text",
    icon: AlertTriangle,
    iconCls: "text-brand-400",
  },
};

function ToastViewport({
  toasts,
  onDismiss,
}: {
  toasts: Toast[];
  onDismiss: (id: number) => void;
}) {
  return (
    <div
      aria-live="polite"
      aria-label="Notifications"
      className="pointer-events-none fixed right-4 top-4 z-[60] flex w-full max-w-sm flex-col gap-2"
    >
      <AnimatePresence initial={false}>
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} onDismiss={onDismiss} />
        ))}
      </AnimatePresence>
    </div>
  );
}

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: (id: number) => void }) {
  const reduce = useReducedMotion();
  const { icon: Icon, wrapper, iconCls } = toneStyles[toast.kind];

  useEffect(() => {
    if (toast.ttlMs <= 0) return;
    const t = setTimeout(() => onDismiss(toast.id), toast.ttlMs);
    return () => clearTimeout(t);
  }, [toast.id, toast.ttlMs, onDismiss]);

  const enterTransition = reduce ? { duration: 0 } : SPRING_DEFAULT;
  const exitTransition = reduce
    ? { duration: 0 }
    : { duration: DURATION_MICRO, ease: EASE_OUT };

  return (
    <motion.div
      role={toast.kind === "error" ? "alert" : "status"}
      layout
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 4, transition: exitTransition }}
      transition={enterTransition}
      className={`pointer-events-auto flex items-start gap-3 rounded-md border px-3 py-2.5 shadow-lg shadow-black/40 ${wrapper}`}
    >
      <Icon size={18} className={`mt-0.5 shrink-0 ${iconCls}`} aria-hidden />
      <div className="flex-1 text-sm leading-snug">{toast.text}</div>
      <button
        type="button"
        onClick={() => onDismiss(toast.id)}
        className="text-text-subtle transition-colors hover:text-text focus:outline-none focus:ring-1 focus:ring-brand-400"
        aria-label="Dismiss notification"
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 14 14"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
          strokeLinecap="round"
        >
          <path d="M3 3 L11 11 M11 3 L3 11" />
        </svg>
      </button>
    </motion.div>
  );
}

export { DURATION_SHORT as TOAST_ENTER_DURATION };
