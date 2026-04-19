import type { RecordStatus } from "@/lib/types";
import { RECORD_STATUS_LABELS } from "@/lib/format";

const styles: Record<RecordStatus, string> = {
  draft: "border-slate-500/40 bg-slate-500/15 text-slate-300",
  in_progress: "border-accent/40 bg-accent/15 text-accent",
  blocked: "border-severity-critical/40 bg-severity-critical/15 text-severity-critical",
  ready: "border-severity-low/40 bg-severity-low/15 text-severity-low",
  closed: "border-slate-600/40 bg-slate-700/30 text-slate-400",
};

export function StatusBadge({ status }: { status: RecordStatus }) {
  return (
    <span className={`chip ${styles[status]}`}>
      {RECORD_STATUS_LABELS[status]}
    </span>
  );
}
