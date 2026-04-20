import type { WorkflowStage } from "@/lib/types";

export type FlashKind = "success" | "error" | "info";

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
  flash: { kind: FlashKind; text: string } | null;
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
  flash,
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

      {flash ? (
        <div
          role="status"
          className={`mt-3 rounded-md border px-3 py-2 text-sm ${
            flash.kind === "success"
              ? "border-severity-low/40 bg-severity-low/10 text-severity-low"
              : flash.kind === "error"
              ? "border-severity-critical/40 bg-severity-critical/10 text-severity-critical"
              : "border-accent/40 bg-accent/10 text-accent"
          }`}
        >
          {flash.text}
        </div>
      ) : null}
    </section>
  );
}
