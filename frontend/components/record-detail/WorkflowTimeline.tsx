import { LoadingSkeleton } from "@/components/LoadingSkeleton";
import { Panel } from "@/components/Panel";
import { StageBadge } from "@/components/StageBadge";
import type { WorkflowStage } from "@/lib/types";

interface WorkflowTimelineProps {
  workflowName?: string;
  stages: WorkflowStage[] | null;
  currentStageId: number;
}

export function WorkflowTimeline({
  workflowName,
  stages,
  currentStageId,
}: WorkflowTimelineProps) {
  const currentStage = stages?.find((s) => s.id === currentStageId);

  return (
    <Panel
      title="Workflow progress"
      description={workflowName ?? "Stages in order, current stage highlighted."}
    >
      {!stages ? (
        <LoadingSkeleton rows={1} />
      ) : (
        <ol className="flex flex-wrap items-center gap-2">
          {stages
            .slice()
            .sort((a, b) => a.order_index - b.order_index)
            .map((stage, idx, arr) => {
              const isCurrent = stage.id === currentStageId;
              const isPast =
                currentStage !== undefined &&
                stage.order_index < currentStage.order_index;
              const tone: "current" | "past" | "future" = isCurrent
                ? "current"
                : isPast
                ? "past"
                : "future";
              return (
                <li key={stage.id} className="flex items-center gap-2">
                  <StageBadge
                    name={stage.name}
                    orderIndex={stage.order_index}
                    tone={tone}
                  />
                  {idx < arr.length - 1 ? (
                    <span className="text-text-subtle" aria-hidden>
                      ›
                    </span>
                  ) : null}
                </li>
              );
            })}
        </ol>
      )}
    </Panel>
  );
}
