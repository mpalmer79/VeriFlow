"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { FormEvent, useEffect, useRef } from "react";

import { DURATION_MICRO, EASE_OUT, dialogPop, overlayFade } from "@/lib/motion";

export type ConfirmTone = "default" | "danger";

export interface ConfirmDialogProps {
  open?: boolean;
  title: string;
  description?: string;
  confirmLabel: string;
  cancelLabel?: string;
  tone?: ConfirmTone;
  busy?: boolean;
  inputLabel?: string;
  inputValue?: string;
  inputPlaceholder?: string;
  onInputChange?: (value: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
}


export function ConfirmDialog(props: ConfirmDialogProps) {
  // Callers historically either mounted / unmounted the dialog by
  // conditional rendering, or passed `open`. Both paths work: the
  // component treats missing `open` as true so AnimatePresence still
  // runs enter animations on mount.
  const open = props.open ?? true;
  return (
    <AnimatePresence mode="wait">
      {open ? <ConfirmDialogInner key="confirm" {...props} /> : null}
    </AnimatePresence>
  );
}


function ConfirmDialogInner({
  title,
  description,
  confirmLabel,
  cancelLabel = "Cancel",
  tone = "default",
  busy = false,
  inputLabel,
  inputValue,
  inputPlaceholder,
  onInputChange,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const reduce = useReducedMotion();
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const confirmBtnRef = useRef<HTMLButtonElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (inputLabel) {
      inputRef.current?.focus();
    } else {
      confirmBtnRef.current?.focus();
    }
  }, [inputLabel]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onCancel();
        return;
      }
      if (e.key !== "Tab") return;
      const node = dialogRef.current;
      if (!node) return;
      const focusable = Array.from(
        node.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])',
        ),
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    onConfirm();
  }

  const confirmCls = tone === "danger" ? "btn-danger" : "btn-primary";
  const transition = reduce
    ? { duration: 0 }
    : { duration: DURATION_MICRO, ease: EASE_OUT };

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={busy ? undefined : onCancel}
      role="presentation"
      variants={overlayFade}
      initial="hidden"
      animate="visible"
      exit="hidden"
      transition={transition}
    >
      <motion.div
        ref={dialogRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        aria-describedby={description ? "confirm-description" : undefined}
        className="w-full max-w-md rounded-md border border-surface-border bg-surface-panel shadow-xl"
        onClick={(e) => e.stopPropagation()}
        variants={dialogPop}
        initial="hidden"
        animate="visible"
        exit="exit"
        transition={transition}
      >
        <form onSubmit={handleSubmit} className="flex flex-col">
          <header className="border-b border-surface-border px-4 py-3">
            <h2 id="confirm-title" className="text-sm font-semibold text-text">
              {title}
            </h2>
          </header>

          <div className="space-y-3 px-4 py-4 text-sm text-text-muted">
            {description ? (
              <p id="confirm-description">{description}</p>
            ) : null}
            {inputLabel ? (
              <label className="flex flex-col gap-1 text-xs">
                <span className="field-label">{inputLabel}</span>
                <input
                  ref={inputRef}
                  type="text"
                  className="input"
                  value={inputValue ?? ""}
                  placeholder={inputPlaceholder}
                  onChange={(e) => onInputChange?.(e.target.value)}
                  disabled={busy}
                />
              </label>
            ) : null}
          </div>

          <footer className="flex items-center justify-end gap-2 border-t border-surface-border px-4 py-3">
            <button
              type="button"
              className="btn-secondary text-xs"
              onClick={onCancel}
              disabled={busy}
            >
              {cancelLabel}
            </button>
            <button
              ref={confirmBtnRef}
              type="submit"
              className={`${confirmCls} text-xs`}
              disabled={busy}
            >
              {busy ? "Working…" : confirmLabel}
            </button>
          </footer>
        </form>
      </motion.div>
    </motion.div>
  );
}
