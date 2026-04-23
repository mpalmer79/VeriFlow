"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from "react";

// HelpCircle not yet in components/icons barrel — direct import is
// deliberate, a followup can migrate it.
import { HelpCircle } from "lucide-react";

import { DURATION_MICRO, EASE_OUT } from "@/lib/motion";

interface InfoPopoverProps {
  /** Short screen-reader label describing what the popover explains. */
  label: string;
  /** The content shown when the popover is open. */
  children: ReactNode;
  /** Which edge of the popover aligns with the trigger button. Default "right". */
  align?: "left" | "right";
  /** Trigger button icon pixel size. Default 14. */
  size?: number;
}

export function InfoPopover({
  label,
  children,
  align = "right",
  size = 14,
}: InfoPopoverProps) {
  const reduce = useReducedMotion();
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const popRef = useRef<HTMLDivElement | null>(null);
  const panelId = useId();

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;
    function onMouseDown(e: MouseEvent) {
      const t = e.target as Node;
      if (popRef.current?.contains(t) || buttonRef.current?.contains(t)) return;
      close();
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        close();
        buttonRef.current?.focus();
      }
    }
    document.addEventListener("mousedown", onMouseDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, close]);

  return (
    <span className="relative inline-flex align-middle">
      <button
        ref={buttonRef}
        type="button"
        aria-label={label}
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        aria-haspopup="dialog"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex h-5 w-5 items-center justify-center rounded-full text-text-subtle transition-colors hover:bg-surface-muted hover:text-text focus:outline-none focus:ring-1 focus:ring-brand-400"
      >
        <HelpCircle size={size} aria-hidden />
      </button>
      <AnimatePresence>
        {open ? (
          <motion.div
            ref={popRef}
            id={panelId}
            role="dialog"
            aria-label={label}
            initial={reduce ? false : { opacity: 0, scale: 0.96, y: -2 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={reduce ? undefined : { opacity: 0, scale: 0.96, y: -2 }}
            transition={
              reduce ? { duration: 0 } : { duration: DURATION_MICRO, ease: EASE_OUT }
            }
            className={`absolute top-full z-30 mt-2 w-[280px] origin-top rounded-md border border-surface-border bg-surface-panel p-3 text-xs leading-relaxed text-text-muted shadow-lg shadow-black/20 sm:w-[320px] ${
              align === "right" ? "right-0 origin-top-right" : "left-0 origin-top-left"
            }`}
          >
            {children}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </span>
  );
}
