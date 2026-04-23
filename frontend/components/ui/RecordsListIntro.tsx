"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useState } from "react";

import { ChevronRight } from "@/components/icons";
import { DURATION_SHORT, EASE_OUT } from "@/lib/motion";

/**
 * "What does this page do and how does it work?" preamble for the
 * records list. Mirrors the Dashboard and record-detail intros; a
 * followup can extract the shared layout once all three have landed.
 */
export function RecordsListIntro() {
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
            What does this page do and how does it work?
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
            <div className="space-y-4 px-4 py-4 text-sm text-text-muted">
              <p>
                <span className="font-medium text-text">What it does.</span>{" "}
                Every record in the active workflow, listed with stage,
                status, risk band, assignee, and last-updated timestamp.
                Each row deep-links to the record&rsquo;s detail page where
                the rule engine&rsquo;s decision is explainable rule by
                rule.
              </p>
              <div>
                <p className="mb-2">
                  <span className="font-medium text-text">How it works.</span>
                </p>
                <ul className="space-y-1.5 pl-4">
                  <li className="list-disc">
                    <span className="font-medium text-text">
                      URL-persisted filters
                    </span>{" "}
                    &mdash; search, stage, risk band, and status all live in
                    the query string, so refresh, the browser back button,
                    and shared links reproduce the same view.
                  </li>
                  <li className="list-disc">
                    <span className="font-medium text-text">
                      Strict-typed fetch
                    </span>{" "}
                    &mdash; the records endpoint returns typed rows; the
                    stage column is joined client-side from a shared
                    workflow-stages cache, keeping the API a thin typed
                    CRUD surface.
                  </li>
                  <li className="list-disc">
                    <span className="font-medium text-text">
                      Blocked-row affordance
                    </span>{" "}
                    &mdash; rows with <span className="mono">status = blocked</span>{" "}
                    get a red left-edge bar so a reviewer can spot them at a
                    glance in a long list without scanning the Status column.
                  </li>
                  <li className="list-disc">
                    <span className="font-medium text-text">
                      Risk at a glance
                    </span>{" "}
                    &mdash; the Risk column shows both the band (low /
                    moderate / high / critical) and the numeric score; bands
                    are held at fixed semantic colors across themes so the
                    meaning doesn&rsquo;t shift when a reviewer swaps light
                    for dark.
                  </li>
                </ul>
              </div>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </section>
  );
}
