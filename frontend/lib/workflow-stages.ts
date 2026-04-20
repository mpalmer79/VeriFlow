import { workflows as workflowsApi } from "./api";
import type { RecordRead, WorkflowStage } from "./types";

export type StageMap = Map<string, WorkflowStage>;

export function stageMapKey(workflowId: number, stageId: number): string {
  return `${workflowId}:${stageId}`;
}

// Fetches every distinct workflow referenced by the records in parallel and
// returns a map keyed on `${workflow_id}:${stage_id}` so records from
// different workflows can resolve their stage names without collisions.
// Individual workflow fetches are failure-tolerant; a missing workflow
// simply leaves its records showing "Stage #N" rather than failing the
// whole screen.
export async function loadStagesForRecords(
  records: RecordRead[],
): Promise<StageMap> {
  const ids = Array.from(new Set(records.map((r) => r.workflow_id)));
  const workflows = await Promise.all(
    ids.map((id) =>
      workflowsApi.get(id).catch(() => null),
    ),
  );
  const map: StageMap = new Map();
  for (const wf of workflows) {
    if (!wf) continue;
    for (const stage of wf.stages) {
      map.set(stageMapKey(wf.id, stage.id), stage);
    }
  }
  return map;
}
