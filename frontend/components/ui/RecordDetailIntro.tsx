"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useState } from "react";

import { ChevronRight } from "@/components/icons";
import { DURATION_SHORT, EASE_OUT } from "@/lib/motion";

/**
 * Short "What's this page about?" preamble for the record detail view.
 * Intentionally terser than the Dashboard intro — visitors hit this
 * page repeatedly, so a scannable bullet list is more useful than a
 * long explanation.
 */
export function RecordDetailIntro() {
  const [open, setOpen] = useState(true);
  const reduce = useReducedMotion();

  return (
    <section aria-label="About this page" className="panel overflow-hidden">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-muted/40 focus:outline-none focus:ring-1 focus:ring-inset focus:ring-brand-400"
      >
        <span className="flex items-center gap-2">
          <span className="field-label">About this page</span>
          <span className="text-sm font-medium text-text">
            What&rsquo;s this page about?
          </span>
        </span>
        <ChevronRight
          size={14}
          className={`text-text-subtle transition-transform ${open ? "rotate-90" : ""}`}
          aria-hidden
        />
      </button>
      <AnimatePresence initial={false}>
        {open ? (
          <motion.div
            key="body"
            initial={reduce ? false : { height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={reduce ? undefined : { height: 0, opacity: 0 }}
            transition={
              reduce ? { duration: 0 } : { duration: DURATION_SHORT, ease: EASE_OUT }
            }
            className="overflow-hidden border-t border-surface-border"
          >
            <div className="space-y-3 px-4 py-4 text-sm text-text-muted">
              <p>
                The detail view for a single record. Five sections, each
                pinning a different guarantee the product makes:
              </p>
              <ul className="space-y-1.5 pl-4">
                <li className="list-disc">
                  <span className="font-medium text-text">Decision banner</span>{" "}
                  &mdash; current status and the rules that drove it.
                </li>
                <li className="list-disc">
                  <span className="font-medium text-text">Evaluation</span>{" "}
                  &mdash; rule-by-rule breakdown with per-rule risk contribution.
                </li>
                <li className="list-disc">
                  <span className="font-medium text-text">Workflow timeline</span>{" "}
                  &mdash; where the record sits across the stages, with the
                  active stage marked <span className="mono">aria-current</span>.
                </li>
                <li className="list-disc">
                  <span className="font-medium text-text">Document evidence</span>{" "}
                  &mdash; SHA-256 at ingest, re-hashed at verify; mismatches
                  surface immediately.
                </li>
                <li className="list-disc">
                  <span className="font-medium text-text">Audit trail</span>{" "}
                  &mdash; append-only and hash-chained, so any tamper attempt
                  breaks <span className="mono">verify</span>.
                </li>
              </ul>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </section>
  );
}
