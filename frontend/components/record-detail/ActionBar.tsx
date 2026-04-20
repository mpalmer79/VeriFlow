import { ArrowRight, Loader2, RefreshCw } from "@/components/icons";
import type { WorkflowStage } from "@/lib/types";

interface ActionBarProps {
  stages: WorkflowStage[];
  currentStageId: number;
  targetStageId: number | "";
  onTargetChange: (id: number | "") => void;
  onEvaluate: () => void;
  onTransition: () => void;
  onRefresh: () => void;
  evaluating: boolean;
  transitioning: boolean;
  transitionBlockedReason?: string | null;
}

export function ActionBar({
  stages,
  currentStageId,
  targetStageId,
  onTargetChange,
  onEvaluate,
  onTransition,
  onRefresh,
  evaluating,
  transitioning,
  transitionBlockedReason,
}: ActionBarProps) {
  const available = stages
    .slice()
    .sort((a, b) => a.order_index - b.order_index)
    .filter((s) => s.id !== currentStageId);

  const transitionDisabled =
    transitioning ||
    targetStageId === "" ||
    Boolean(transitionBlockedReason);

  return (
    <section className="panel p-4" aria-label="Record actions">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          className="btn-secondary"
          onClick={onEvaluate}
          disabled={evaluating}
        >
          {evaluating ? (
            <>
              <Loader2 size={14} className="animate-spin" aria-hidden />
              Evaluating…
            </>
          ) : (
            "Run evaluation"
          )}
        </button>

        <div className="flex items-center gap-2">
          <label className="field-label" htmlFor="target-stage">
            Transition to
          </label>
          <select
            id="target-stage"
            className="input w-56"
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
            className="inline-flex items-center gap-2 rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-300 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-brand-600"
            onClick={onTransition}
            disabled={transitionDisabled}
            title={transitionBlockedReason ?? undefined}
            aria-disabled={transitionDisabled}
          >
            {transitioning ? (
              <>
                <Loader2 size={14} className="animate-spin" aria-hidden />
                Attempting…
              </>
            ) : (
              <>
                Attempt transition
                <ArrowRight size={14} aria-hidden />
              </>
            )}
          </button>
        </div>

        <button
          type="button"
          className="ml-auto inline-flex h-8 w-8 items-center justify-center rounded-md border border-surface-border text-text-muted transition-colors hover:border-text-subtle hover:text-text focus:outline-none focus:ring-1 focus:ring-brand-400 disabled:cursor-not-allowed disabled:opacity-50"
          onClick={onRefresh}
          disabled={evaluating || transitioning}
          aria-label="Refresh"
          title="Refresh"
        >
          <RefreshCw size={14} aria-hidden />
        </button>
      </div>
    </section>
  );
}
