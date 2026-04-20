"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

import { EmptyState } from "@/components/EmptyState";
import { AlertOctagon, CircleCheck } from "@/components/icons";
import { Panel } from "@/components/Panel";
import { SeverityPanel } from "@/components/SeverityPanel";
import { DURATION_SHORT, EASE_OUT, SPRING_SOFT } from "@/lib/motion";
import type { EvaluationDecision, RiskBand } from "@/lib/types";

interface EvaluationPanelProps {
  decision: EvaluationDecision | null;
  onEvaluate: () => void;
  evaluating: boolean;
}

const RISK_BAND_COLOR: Record<RiskBand, string> = {
  low: "bg-severity-low",
  moderate: "bg-severity-moderate",
  high: "bg-severity-high",
  critical: "bg-severity-critical",
};

const RISK_BAND_TEXT: Record<RiskBand, string> = {
  low: "text-severity-low",
  moderate: "text-severity-moderate",
  high: "text-severity-high",
  critical: "text-severity-critical",
};

const RISK_BAND_TICKS = [25, 50, 80] as const;
const RISK_MAX_DISPLAY = 100;

export function EvaluationPanel({
  decision,
  onEvaluate,
  evaluating,
}: EvaluationPanelProps) {
  return (
    <Panel
      title="Evaluation"
      description="Latest rule decision and risk. Replaced on every run."
    >
      {!decision ? (
        <EmptyState
          title="No evaluation on file"
          description="Run evaluation to see which rules pass, warn, or block right now."
        >
          <button
            type="button"
            className="btn-primary mt-3"
            onClick={onEvaluate}
            disabled={evaluating}
          >
            {evaluating ? "Evaluating…" : "Run evaluation"}
          </button>
        </EmptyState>
      ) : (
        <motion.div layout className="space-y-5">
          <CanProgressBar canProgress={decision.can_progress} />
          <RiskScoreBar score={decision.risk_score} band={decision.risk_band} />
          <p className="text-sm text-text-muted">{decision.summary}</p>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <SeverityPanel
              tone="critical"
              title="Blocking issues"
              emptyLabel="No blocking issues. All block-level rules passed."
              issues={decision.violations}
            />
            <SeverityPanel
              tone="warning"
              title="Warnings"
              emptyLabel="No active warnings."
              issues={decision.warnings}
            />
          </div>
        </motion.div>
      )}
    </Panel>
  );
}

function CanProgressBar({ canProgress }: { canProgress: boolean }) {
  const reduce = useReducedMotion();
  const toneBg = canProgress ? "bg-verified/15" : "bg-severity-critical/15";
  const toneFill = canProgress ? "bg-verified" : "bg-severity-critical";
  const toneText = canProgress ? "text-verified" : "text-severity-critical";
  const Icon = canProgress ? CircleCheck : AlertOctagon;
  const label = canProgress ? "Can progress" : "Blocked";

  return (
    <div className="panel-muted overflow-hidden">
      <div
        className={`relative flex items-center gap-3 px-4 py-3 ${toneBg}`}
      >
        <motion.span
          layout
          className={`absolute inset-y-0 left-0 ${toneFill}`}
          style={{ width: canProgress ? "100%" : "20%", opacity: 0.18 }}
          transition={reduce ? { duration: 0 } : SPRING_SOFT}
        />
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={canProgress ? "ok" : "blocked"}
            className={`relative z-10 inline-flex h-8 w-8 items-center justify-center rounded-full bg-surface-panel ${toneText}`}
            initial={reduce ? false : { scale: 0.85, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={reduce ? undefined : { scale: 0.85, opacity: 0 }}
            transition={
              reduce ? { duration: 0 } : { duration: DURATION_SHORT, ease: EASE_OUT }
            }
          >
            <Icon size={18} aria-hidden />
          </motion.span>
        </AnimatePresence>
        <div className="relative z-10">
          <div className="field-label">Can progress</div>
          <div className={`font-display text-lg font-semibold ${toneText}`}>
            {label}
          </div>
        </div>
      </div>
    </div>
  );
}

function RiskScoreBar({ score, band }: { score: number; band: RiskBand }) {
  const reduce = useReducedMotion();
  const pct = Math.min(100, Math.max(0, (score / RISK_MAX_DISPLAY) * 100));
  return (
    <div className="panel-muted px-4 py-3">
      <div className="flex items-baseline justify-between gap-4">
        <div className="field-label">Risk score</div>
        <div className="flex items-baseline gap-2">
          <span
            className={`font-display text-2xl font-semibold tabular-nums ${RISK_BAND_TEXT[band]}`}
          >
            {score}
          </span>
          <span className={`text-xs uppercase tracking-wide ${RISK_BAND_TEXT[band]}`}>
            {band}
          </span>
        </div>
      </div>
      <div className="relative mt-3 h-2 overflow-hidden rounded-full bg-surface-border/70">
        <motion.div
          layout
          className={`absolute inset-y-0 left-0 rounded-full ${RISK_BAND_COLOR[band]}`}
          initial={false}
          animate={{ width: `${pct}%` }}
          transition={reduce ? { duration: 0 } : SPRING_SOFT}
        />
        {RISK_BAND_TICKS.map((tick) => (
          <span
            key={tick}
            aria-hidden
            className="absolute inset-y-0 w-px bg-surface-panel"
            style={{ left: `${tick}%` }}
          />
        ))}
      </div>
      <div className="mt-1 flex justify-between text-[10px] uppercase tracking-wide text-text-subtle">
        <span>0</span>
        <span>25</span>
        <span>50</span>
        <span>80</span>
        <span>100</span>
      </div>
    </div>
  );
}
