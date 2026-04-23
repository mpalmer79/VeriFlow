"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useState } from "react";

import { ChevronRight } from "@/components/icons";
import { DURATION_SHORT, EASE_OUT } from "@/lib/motion";

/**
 * "What's this page about?" preamble pinned to the top of the Dashboard.
 * Open by default so a first-time visitor sees the framing immediately;
 * collapsible so a returning operator can hide it.
 */
export function DashboardIntro() {
  const [open, setOpen] = useState(true);
  const reduce = useReducedMotion();

  return (
    <section
      aria-label="About this page"
      className="panel overflow-hidden"
    >
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
            <div className="space-y-4 px-4 py-4 text-sm text-text-muted">
              <p>
                The Dashboard is VeriFlow&rsquo;s operations surface &mdash; a
                live summary of every record moving through the active
                workflow. It answers three questions at a glance:
              </p>
              <ul className="space-y-2 pl-4">
                <li className="list-disc">
                  <span className="font-medium text-text">
                    What&rsquo;s moving and what&rsquo;s stuck?
                  </span>{" "}
                  The KPI strip counts records by status (in progress,
                  blocked) and by risk band (high, critical). The{" "}
                  <span className="font-medium text-text">Blocked</span> card
                  outlines itself in red when the count is non-zero, so no
                  operator has to scan the grid.
                </li>
                <li className="list-disc">
                  <span className="font-medium text-text">
                    What needs attention first?
                  </span>{" "}
                  The <span className="font-medium text-text">Needs attention</span>{" "}
                  table is sorted blocked-first, then by descending risk
                  score, then by most recent update. Every row deep-links to
                  the record detail page, where the rule engine&rsquo;s
                  decision is explainable line by line &mdash; which rules
                  ran, which failed, the risk each one contributed, and the
                  human-readable reason.
                </li>
                <li className="list-disc">
                  <span className="font-medium text-text">
                    Is what I&rsquo;m seeing current?
                  </span>{" "}
                  The <span className="font-medium text-text">LIVE / STALE</span>{" "}
                  pill reflects a 30-second background poll that is gated on
                  tab visibility &mdash; minimized tabs stop polling to spare
                  the database, and re-focusing a stale tab triggers an
                  immediate refresh.
                </li>
              </ul>
              <div className="rounded-md border border-surface-border bg-surface-muted/40 p-3 text-xs">
                <div className="field-label mb-1">Under the hood</div>
                <p className="text-text-muted">
                  FastAPI + SQLAlchemy 2.x on Postgres (SQLite under local
                  tests), Next.js 14 App Router with strict-typed API calls
                  end-to-end, Framer Motion for the LIVE-pill transition and
                  staggered table entry, and a tab-visibility-gated 30s poll
                  backed by the Page Visibility API. Every domain event
                  writes through an append-only audit table whose{" "}
                  <span className="mono">entry_hash</span> chains to the
                  previous row; record mutations use optimistic concurrency
                  via a <span className="mono">version</span> column. The
                  engine is domain-agnostic &mdash; the reference scenario
                  is healthcare intake, but the same data model handles loan
                  intake, vendor onboarding, and claims triage.
                </p>
              </div>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </section>
  );
}
