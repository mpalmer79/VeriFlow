import type { RecordStatus } from "@/lib/types";
import { RECORD_STATUS_LABELS } from "@/lib/format";

const styles: Record<RecordStatus, { chip: string; dot: string }> = {
  draft: {
    chip: "border-slate-500/40 bg-slate-500/15 text-slate-300",
    dot: "bg-slate-400",
  },
  in_progress: {
    chip: "border-accent/40 bg-accent/15 text-accent",
    dot: "bg-accent",
  },
  blocked: {
    chip: "border-severity-critical/40 bg-severity-critical/15 text-severity-critical",
    dot: "bg-severity-critical animate-chain-pulse",
  },
  ready: {
    chip: "border-severity-low/40 bg-severity-low/15 text-severity-low",
    dot: "bg-severity-low",
  },
  closed: {
    chip: "border-slate-600/40 bg-slate-700/30 text-slate-400",
    dot: "bg-slate-500",
  },
};

export function StatusBadge({ status }: { status: RecordStatus }) {
  const { chip, dot } = styles[status];
  return (
    <span className={`chip gap-1.5 ${chip}`}>
      <span className={`inline-block h-1.5 w-1.5 rounded-full ${dot}`} aria-hidden />
      {RECORD_STATUS_LABELS[status]}
    </span>
  );
}
