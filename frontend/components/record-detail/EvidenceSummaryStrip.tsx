import { formatBytes } from "@/lib/format";
import type { EvidenceSummary } from "@/lib/types";


interface EvidenceSummaryStripProps {
  summary: EvidenceSummary | null;
}

export function EvidenceSummaryStrip({ summary }: EvidenceSummaryStripProps) {
  if (!summary) return null;
  return (
    <dl className="grid grid-cols-2 gap-2 rounded-md border border-surface-border bg-surface-muted/40 p-3 text-xs sm:grid-cols-4">
      <Cell label="Upload-backed" value={summary.upload_backed} />
      <Cell label="Metadata only" value={summary.metadata_only} />
      <Cell label="Verified" value={summary.verified} />
      <Cell label="Stored bytes" value={formatBytes(summary.stored_bytes)} />
    </dl>
  );
}


function Cell({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="px-1">
      <dt className="field-label">{label}</dt>
      <dd className="mt-0.5 text-sm font-semibold tabular-nums">{value}</dd>
    </div>
  );
}
