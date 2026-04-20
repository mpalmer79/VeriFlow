import { EmptyState } from "@/components/EmptyState";
import { Panel } from "@/components/Panel";
import { RiskBadge } from "@/components/RiskBadge";
import { SeverityPanel } from "@/components/SeverityPanel";
import type { EvaluationDecision } from "@/lib/types";

interface EvaluationPanelProps {
  decision: EvaluationDecision | null;
  onEvaluate: () => void;
  evaluating: boolean;
}

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
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <StatCellSmall
              label="Can progress"
              tone={decision.can_progress ? "ok" : "critical"}
              value={decision.can_progress ? "Yes" : "No"}
            />
            <StatCellSmall
              label="Risk score"
              value={decision.risk_score}
              tone="neutral"
            />
            <div className="panel-muted p-3">
              <div className="field-label">Risk band</div>
              <div className="mt-1">
                <RiskBadge
                  band={decision.risk_band}
                  score={decision.risk_score}
                  size="md"
                />
              </div>
            </div>
          </div>
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
        </div>
      )}
    </Panel>
  );
}


function StatCellSmall({
  label,
  value,
  tone,
}: {
  label: string;
  value: string | number;
  tone: "neutral" | "ok" | "critical" | "warning";
}) {
  const toneCls =
    tone === "ok"
      ? "text-severity-low"
      : tone === "critical"
      ? "text-severity-critical"
      : tone === "warning"
      ? "text-severity-high"
      : "text-text";
  return (
    <div className="panel-muted p-3">
      <div className="field-label">{label}</div>
      <div className={`mt-1 text-lg font-semibold tabular-nums ${toneCls}`}>
        {value}
      </div>
    </div>
  );
}
