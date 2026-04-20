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
}: ActionBarProps) {
  const available = stages
    .slice()
    .sort((a, b) => a.order_index - b.order_index)
    .filter((s) => s.id !== currentStageId);

  return (
    <section className="panel p-4" aria-label="Record actions">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          className="btn-primary"
          onClick={onEvaluate}
          disabled={evaluating}
        >
          {evaluating ? "Evaluating…" : "Run evaluation"}
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
            className="btn-secondary"
            onClick={onTransition}
            disabled={transitioning || targetStageId === ""}
          >
            {transitioning ? "Attempting…" : "Attempt transition"}
          </button>
        </div>

        <button
          type="button"
          className="btn-secondary ml-auto"
          onClick={onRefresh}
          disabled={evaluating || transitioning}
        >
          Refresh
        </button>
      </div>
    </section>
  );
}
