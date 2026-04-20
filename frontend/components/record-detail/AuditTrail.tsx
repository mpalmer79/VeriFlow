import { EmptyState } from "@/components/EmptyState";
import { Panel } from "@/components/Panel";
import { formatDateTime } from "@/lib/format";
import type { AuditEntry } from "@/lib/types";


const AUDIT_KEYS_OF_INTEREST = [
  "current_stage_id",
  "target_stage_id",
  "prior_stage_id",
  "new_stage_id",
  "stage_context_id",
  "rules_evaluated",
  "blocking_rule_codes",
  "warning_rule_codes",
  "risk_score",
  "risk_band",
  "prior_risk_score",
  "new_risk_score",
  "document_type",
  "document_status",
  "verified_by",
  "rejected_by",
  "rejection_reason",
];


export function AuditTrail({ entries }: { entries: AuditEntry[] }) {
  return (
    <Panel
      title="Audit trail"
      description="Append-only. Most recent events first."
    >
      {entries.length === 0 ? (
        <EmptyState
          title="No audit history yet"
          description="Audit events will appear here after the first evaluation, transition, or document change."
        />
      ) : (
        <ol className="space-y-2">
          {entries.map((entry) => (
            <AuditRow key={entry.id} entry={entry} />
          ))}
        </ol>
      )}
    </Panel>
  );
}


function AuditRow({ entry }: { entry: AuditEntry }) {
  const payload = entry.payload ?? {};
  const items: { key: string; value: string }[] = [];
  for (const key of AUDIT_KEYS_OF_INTEREST) {
    const raw = (payload as Record<string, unknown>)[key];
    if (raw === undefined || raw === null) continue;
    const value = Array.isArray(raw)
      ? raw.map(String).join(", ") || "—"
      : typeof raw === "object"
      ? JSON.stringify(raw)
      : String(raw);
    items.push({ key, value });
  }
  return (
    <li className="panel-muted p-3">
      <div className="flex items-start justify-between gap-3">
        <code className="font-mono text-xs text-text">{entry.action}</code>
        <span className="text-xs text-text-muted">
          {formatDateTime(entry.created_at)}
        </span>
      </div>
      {items.length > 0 ? (
        <dl className="mt-2 grid grid-cols-1 gap-x-4 gap-y-1 text-xs sm:grid-cols-2">
          {items.map(({ key, value }) => (
            <div key={key} className="flex gap-2">
              <dt className="font-mono text-text-subtle">{key}:</dt>
              <dd className="break-all text-text">{value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
    </li>
  );
}
