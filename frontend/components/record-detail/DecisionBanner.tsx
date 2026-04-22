"use client";

import { useMemo } from "react";

import { Activity, AlertOctagon, CircleCheck } from "@/components/icons";
import { RuleCodeBadge } from "@/components/ui/RuleCodeBadge";
import type {
  EvaluationDecision,
  EvaluationIssue,
  RecordRead,
  RiskBand,
  WorkflowStage,
} from "@/lib/types";

export interface DecisionBannerOrientation {
  subjectFullName: string;
  externalReference: string | null;
  currentStage: WorkflowStage | undefined;
  totalStages: number | undefined;
}

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
  orientation: DecisionBannerOrientation;
  stages: WorkflowStage[];
  targetStageId: number | "";
  onTargetChange: (id: number | "") => void;
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
      // A record that has never been evaluated is a control gap, not a
      // neutral "default" — render it in the warning tier so it reads
      // as "needs attention," not "nothing happened yet."
      return "rounded-lg border border-severity-moderate/60 bg-severity-moderate/10 p-5";
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

interface StagePickerProps {
  stages: WorkflowStage[];
  currentStageId: number;
  targetStageId: number | "";
  onTargetChange: (id: number | "") => void;
  onTransition: () => void;
  transitioning: boolean;
}

function StagePicker({
  stages,
  currentStageId,
  targetStageId,
  onTargetChange,
  onTransition,
  transitioning,
}: StagePickerProps) {
  const available = stages
    .slice()
    .sort((a, b) => a.order_index - b.order_index)
    .filter((s) => s.id !== currentStageId);

  const targetStage =
    targetStageId === ""
      ? undefined
      : available.find((s) => s.id === Number(targetStageId));

  const advanceDisabled = transitioning || targetStageId === "";

  return (
    <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
      <label className="sr-only" htmlFor="target-stage">
        Transition to
      </label>
      <select
        id="target-stage"
        className="input w-full sm:w-56"
        value={targetStageId}
        onChange={(e) =>
          onTargetChange(e.target.value === "" ? "" : Number(e.target.value))
        }
        disabled={transitioning}
      >
        <option value="">Select stage…</option>
        {available.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </select>
      <button
        type="button"
        onClick={onTransition}
        disabled={advanceDisabled}
        aria-label={
          targetStage
            ? `Advance record to stage ${targetStage.name}`
            : "Advance — select a target stage first"
        }
        className="btn-primary w-full sm:w-auto"
      >
        {transitioning
          ? "Transitioning…"
          : targetStage
            ? `Advance to ${targetStage.name}`
            : "Advance"}
      </button>
    </div>
  );
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
  orientation,
  stages,
  targetStageId,
  onTargetChange,
}: DecisionBannerProps): JSX.Element {
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
  }, [
    decision,
    record.status,
    record.version,
    currentStage?.is_terminal,
    currentStage?.name,
    targetStage?.id,
  ]);

  const stageClauseVisible =
    orientation.currentStage !== undefined &&
    orientation.totalStages !== undefined;

  return (
    // Rendered as a plain <section> (no motion) so the parent
    // staggerChildren schedule skips the banner entirely — motion now
    // reinforces that this element is the lede, not flattens it into
    // one more panel in the cascade.
    <section
      role={state.kind === "not_evaluated" ? undefined : "status"}
      aria-live={state.kind === "not_evaluated" ? undefined : "polite"}
      aria-atomic="true"
      className={toneClassNames(state.kind)}
    >
      {/* Orientation strip — the only place on the page where subject,
          reference, and stage position live. RecordHeader is gone. */}
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-text-muted">
        <span>{orientation.subjectFullName}</span>
        <span aria-hidden="true">·</span>
        {orientation.externalReference ? (
          <span className="mono text-text">{orientation.externalReference}</span>
        ) : (
          <span>—</span>
        )}
        {stageClauseVisible &&
        orientation.currentStage !== undefined &&
        orientation.totalStages !== undefined ? (
          <>
            <span aria-hidden="true">·</span>
            <span>
              {`Stage ${orientation.currentStage.order_index + 1} of ${orientation.totalStages} — ${orientation.currentStage.name}`}
            </span>
          </>
        ) : null}
      </div>
      <div className="mt-3 h-px w-full bg-surface-border/60" aria-hidden="true" />

      <div className="mt-4 flex flex-col items-stretch gap-4 sm:flex-row sm:items-start">
        <div className="flex flex-shrink-0 items-start">
          {state.kind === "not_evaluated" ? (
            <Activity
              size={24}
              className="text-severity-moderate"
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

        <div className="flex flex-shrink-0 flex-col items-stretch gap-2 sm:self-start">
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
          {state.kind === "ready" || state.kind === "terminal_blocked" ? (
            <StagePicker
              stages={stages}
              currentStageId={record.current_stage_id}
              targetStageId={targetStageId}
              onTargetChange={onTargetChange}
              onTransition={onTransition}
              transitioning={transitioning}
            />
          ) : null}
          {state.kind === "closed" ? (
            <span className="text-xs text-text-subtle">
              Archived. No action required.
            </span>
          ) : null}
        </div>
      </div>

      {state.kind === "blocked" ? (
        <div className="mt-4 rounded-md bg-severity-critical/5 p-3">
          <div className="flex flex-wrap items-center gap-2">
            <RuleCodeBadge code={state.topIssue.rule_code} />
            <span className="text-xs font-semibold text-severity-critical">
              +{state.topIssue.risk_applied}
            </span>
          </div>
          <p className="mt-1.5 line-clamp-3 text-sm text-text">
            {state.topIssue.message}
          </p>
          {state.violationCount > 1 ? (
            <button
              type="button"
              onClick={onFocusEvaluation}
              className="mt-2 text-xs text-text-muted underline-offset-2 hover:text-text hover:underline focus:outline-none focus:underline"
            >
              {`+ ${state.violationCount - 1} more blocking ${state.violationCount - 1 === 1 ? "issue" : "issues"}`}
            </button>
          ) : null}
        </div>
      ) : null}

      {state.kind === "ready" && state.topWarning !== null ? (
        <div className="mt-4 rounded-md bg-severity-moderate/5 p-3">
          <div className="flex flex-wrap items-center gap-2">
            <RuleCodeBadge code={state.topWarning.rule_code} />
            <span className="text-xs font-semibold text-severity-moderate">
              +{state.topWarning.risk_applied}
            </span>
          </div>
          <p className="mt-1.5 line-clamp-3 text-sm text-text">
            {state.topWarning.message}
          </p>
        </div>
      ) : null}

      {state.kind === "ready" && state.topWarning === null ? (
        <div className="mt-4 rounded-md bg-severity-verified/5 p-3">
          <p className="text-sm text-text-muted">
            All block-level rules passed.
          </p>
        </div>
      ) : null}
    </section>
  );
}
