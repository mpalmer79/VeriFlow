"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useMemo } from "react";

import { Activity, AlertOctagon, CircleCheck } from "@/components/icons";
import { RuleCodeBadge } from "@/components/ui/RuleCodeBadge";
import { DURATION_MEDIUM, EASE_OUT_EXPO, fadeRise } from "@/lib/motion";
import type {
  EvaluationDecision,
  EvaluationIssue,
  RecordRead,
  RiskBand,
  WorkflowStage,
} from "@/lib/types";

export interface DecisionBannerProps {
  record: RecordRead;
  currentStage: WorkflowStage | undefined;
  decision: EvaluationDecision | null;
  targetStage: WorkflowStage | undefined;
  totalStages: number | undefined;
  evaluating: boolean;
  transitioning: boolean;
  onEvaluate: () => void;
  onTransition: () => void;
  onFocusEvaluation: () => void;
}

type BannerState =
  | { kind: "not_evaluated" }
  | {
      kind: "blocked";
      topIssue: EvaluationIssue;
      violationCount: number;
      warningCount: number;
      riskScore: number;
      riskBand: RiskBand;
    }
  | {
      kind: "ready";
      topWarning: EvaluationIssue | null;
      warningCount: number;
      riskScore: number;
      riskBand: RiskBand;
    }
  | {
      kind: "terminal_blocked";
      stageName: string | undefined;
    }
  | {
      kind: "closed";
      stageName: string | undefined;
    };

function pickTopIssue(
  issues: readonly EvaluationIssue[],
): EvaluationIssue | null {
  if (issues.length === 0) return null;
  let best = issues[0];
  for (let i = 1; i < issues.length; i += 1) {
    if (issues[i].risk_applied > best.risk_applied) best = issues[i];
  }
  return best;
}

function toneClassNames(kind: BannerState["kind"]): string {
  switch (kind) {
    case "not_evaluated":
      return "rounded-lg border border-surface-border bg-surface-panel p-5";
    case "blocked":
    case "terminal_blocked":
      return "rounded-lg border border-severity-critical/60 bg-severity-critical/10 p-5";
    case "ready":
      return "rounded-lg border border-severity-verified/60 bg-severity-verified/10 p-5";
    case "closed":
      return "rounded-lg border border-surface-border bg-surface-muted p-5";
  }
}

function pluralize(count: number, singular: string, plural: string): string {
  return count === 1 ? singular : plural;
}

export function DecisionBanner({
  record,
  currentStage,
  decision,
  targetStage,
  totalStages,
  evaluating,
  transitioning,
  onEvaluate,
  onTransition,
  onFocusEvaluation,
}: DecisionBannerProps): JSX.Element {
  const reduce = useReducedMotion();

  const state: BannerState = useMemo(() => {
    // Authoritative record state trumps any stale decision payload:
    // a closed or terminally-blocked record is done routing through
    // the rule engine, regardless of what the last evaluation said.
    if (record.status === "closed") {
      return { kind: "closed", stageName: currentStage?.name };
    }
    if (currentStage?.is_terminal === true && record.status === "blocked") {
      return { kind: "terminal_blocked", stageName: currentStage.name };
    }
    if (decision === null) {
      return { kind: "not_evaluated" };
    }
    if (decision.violations.length > 0) {
      const top = pickTopIssue(decision.violations);
      const topIssue: EvaluationIssue = top ?? decision.violations[0];
      return {
        kind: "blocked",
        topIssue,
        violationCount: decision.violations.length,
        warningCount: decision.warnings.length,
        riskScore: decision.risk_score,
        riskBand: decision.risk_band,
      };
    }
    return {
      kind: "ready",
      topWarning: pickTopIssue(decision.warnings),
      warningCount: decision.warnings.length,
      riskScore: decision.risk_score,
      riskBand: decision.risk_band,
    };
    // record.version bumps on every status/stage change, so keying on
    // it covers record.status and currentStage.is_terminal transitions.
  }, [
    decision,
    record.status,
    record.version,
    currentStage?.is_terminal,
    currentStage?.name,
    targetStage?.id,
  ]);

  const transition = reduce
    ? { duration: 0 }
    : { duration: DURATION_MEDIUM, ease: EASE_OUT_EXPO };

  const stageClauseVisible =
    currentStage !== undefined && totalStages !== undefined;

  const showAdvanceCta =
    (state.kind === "ready" || state.kind === "terminal_blocked") &&
    targetStage !== undefined &&
    targetStage.id !== record.current_stage_id;

  const showChooseStageHint =
    (state.kind === "ready" || state.kind === "terminal_blocked") &&
    (targetStage === undefined || targetStage.id === record.current_stage_id);

  return (
    <motion.section
      role={state.kind === "not_evaluated" ? undefined : "status"}
      aria-live={state.kind === "not_evaluated" ? undefined : "polite"}
      aria-atomic="true"
      variants={fadeRise}
      transition={transition}
      className={toneClassNames(state.kind)}
    >
      <div className="flex flex-col items-stretch gap-4 sm:flex-row sm:items-start">
        <div className="flex flex-shrink-0 items-start">
          {state.kind === "not_evaluated" ? (
            <Activity
              size={24}
              className="text-text-muted"
              aria-hidden="true"
            />
          ) : null}
          {state.kind === "blocked" || state.kind === "terminal_blocked" ? (
            <AlertOctagon
              size={24}
              className="text-severity-critical"
              aria-hidden="true"
            />
          ) : null}
          {state.kind === "ready" ? (
            <CircleCheck
              size={24}
              className="text-severity-verified"
              aria-hidden="true"
            />
          ) : null}
          {state.kind === "closed" ? (
            <CircleCheck
              size={24}
              className="text-text-muted"
              aria-hidden="true"
            />
          ) : null}
        </div>

        <div className="min-w-0 flex-1">
          <h2 className="font-display text-xl font-semibold tracking-tight text-text sm:text-2xl">
            {state.kind === "not_evaluated" ? "Not evaluated yet." : null}
            {state.kind === "blocked" ? "Blocked." : null}
            {state.kind === "terminal_blocked" ? "Blocked." : null}
            {state.kind === "ready" ? "Ready to advance." : null}
            {state.kind === "closed" ? "Closed." : null}
          </h2>
          <p className="mt-1 text-sm text-text-muted">
            {state.kind === "not_evaluated"
              ? "Run evaluation to see which rules block, which warn, and the current risk score."
              : null}
            {state.kind === "blocked"
              ? `${state.violationCount} ${pluralize(state.violationCount, "rule", "rules")} failing · ${state.warningCount} ${pluralize(state.warningCount, "warning", "warnings")} · risk ${state.riskScore}/${state.riskBand}`
              : null}
            {state.kind === "terminal_blocked"
              ? state.stageName
                ? `Record is at the terminal ${state.stageName} stage. Advance to a non-terminal stage to reopen the workflow.`
                : "Record is at a terminal blocked stage. Advance to a non-terminal stage to reopen the workflow."
              : null}
            {state.kind === "ready" ? (
              <>
                {`No blocking issues. Risk ${state.riskScore}/${state.riskBand}.`}
                {state.warningCount > 0
                  ? ` ${state.warningCount} ${pluralize(state.warningCount, "warning", "warnings")} on record.`
                  : null}
              </>
            ) : null}
            {state.kind === "closed"
              ? "This record reached the terminal closed stage. No further action required."
              : null}
          </p>
        </div>

        <div className="flex flex-shrink-0 items-start sm:self-start">
          {state.kind === "not_evaluated" ? (
            <button
              type="button"
              onClick={onEvaluate}
              disabled={evaluating}
              aria-label="Run evaluation for this record"
              className="btn-primary w-full sm:w-auto"
            >
              {evaluating ? "Evaluating…" : "Run evaluation"}
            </button>
          ) : null}
          {state.kind === "blocked" ? (
            <button
              type="button"
              onClick={onFocusEvaluation}
              aria-label={`Resolve ${state.violationCount} blocking ${state.violationCount === 1 ? "issue" : "issues"}`}
              className="btn-primary w-full sm:w-auto"
            >
              Resolve blocking issues
            </button>
          ) : null}
          {showAdvanceCta && targetStage !== undefined ? (
            <button
              type="button"
              onClick={onTransition}
              disabled={transitioning}
              aria-label={`Advance record to stage ${targetStage.name}`}
              className="btn-primary w-full sm:w-auto"
            >
              {transitioning ? "Transitioning…" : `Advance to ${targetStage.name}`}
            </button>
          ) : null}
          {showChooseStageHint ? (
            <span className="text-xs text-text-subtle">
              Choose next stage below.
            </span>
          ) : null}
          {state.kind === "closed" ? (
            <span className="text-xs text-text-subtle">
              Archived. No action required.
            </span>
          ) : null}
        </div>
      </div>

      {state.kind === "blocked" ? (
        <div className="mt-4 border-l-2 border-surface-border/80 pl-3">
          <div className="flex flex-wrap items-center gap-2">
            <RuleCodeBadge code={state.topIssue.rule_code} />
            <span className="text-xs font-semibold text-severity-critical">
              +{state.topIssue.risk_applied}
            </span>
          </div>
          <p className="mt-1.5 line-clamp-2 text-sm text-text-muted">
            {state.topIssue.message}
          </p>
        </div>
      ) : null}

      {state.kind === "ready" && state.topWarning !== null ? (
        <div className="mt-4 border-l-2 border-surface-border/80 pl-3">
          <div className="flex flex-wrap items-center gap-2">
            <RuleCodeBadge code={state.topWarning.rule_code} />
            <span className="text-xs font-semibold text-severity-moderate">
              +{state.topWarning.risk_applied}
            </span>
          </div>
          <p className="mt-1.5 line-clamp-2 text-sm text-text-muted">
            {state.topWarning.message}
          </p>
        </div>
      ) : null}

      {state.kind === "ready" && state.topWarning === null ? (
        <div className="mt-4 border-l-2 border-surface-border/80 pl-3">
          <p className="text-sm text-text-muted">
            All block-level rules passed.
          </p>
        </div>
      ) : null}

      <div className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-1 border-t border-surface-border/60 pt-3 text-xs text-text-muted">
        <span>{record.subject_full_name}</span>
        <span aria-hidden="true">·</span>
        {record.external_reference ? (
          <span className="mono text-text">{record.external_reference}</span>
        ) : (
          <span>—</span>
        )}
        <span aria-hidden="true">·</span>
        {stageClauseVisible && currentStage !== undefined && totalStages !== undefined ? (
          <>
            <span>
              {`Stage ${currentStage.order_index + 1} of ${totalStages}`}
            </span>
            <span aria-hidden="true">·</span>
          </>
        ) : null}
        {currentStage !== undefined ? (
          <span>{currentStage.name}</span>
        ) : (
          <span>—</span>
        )}
      </div>
    </motion.section>
  );
}
