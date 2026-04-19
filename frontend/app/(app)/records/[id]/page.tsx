"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import { ApiError, audit, documents, records, workflows } from "@/lib/api";
import type {
  AuditEntry,
  DocumentRead,
  DocumentStatusResponse,
  DocumentType,
  EvaluationDecision,
  EvaluationIssue,
  RecordRead,
  RuleEvaluationRow,
  WorkflowStage,
} from "@/lib/types";
import {
  DOCUMENT_TYPE_LABELS,
  formatDate,
  formatDateTime,
  titleCase,
} from "@/lib/format";
import { DocumentStatusChip } from "@/components/DocumentStatusChip";
import { EmptyState } from "@/components/EmptyState";
import { ErrorBanner } from "@/components/ErrorBanner";
import { LoadingSkeleton } from "@/components/LoadingSkeleton";
import { Panel } from "@/components/Panel";
import { RiskBadge } from "@/components/RiskBadge";
import { StatusBadge } from "@/components/StatusBadge";

interface WorkflowData {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  stages: WorkflowStage[];
}

type FlashKind = "success" | "error" | "info";
interface Flash {
  kind: FlashKind;
  text: string;
}

export default function RecordDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const recordId = Number(params.id);

  const [record, setRecord] = useState<RecordRead | null>(null);
  const [docStatus, setDocStatus] = useState<DocumentStatusResponse | null>(null);
  const [auditEntries, setAuditEntries] = useState<AuditEntry[]>([]);
  const [evaluationsRaw, setEvaluationsRaw] = useState<RuleEvaluationRow[]>([]);
  const [workflow, setWorkflow] = useState<WorkflowData | null>(null);
  const [decision, setDecision] = useState<EvaluationDecision | null>(null);

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);

  const [evaluating, setEvaluating] = useState(false);
  const [transitioning, setTransitioning] = useState(false);
  const [targetStageId, setTargetStageId] = useState<number | "">("");
  const [flash, setFlash] = useState<Flash | null>(null);
  const [busyDocId, setBusyDocId] = useState<number | null>(null);

  const refreshAll = useCallback(
    async (opts: { silent?: boolean } = {}) => {
      if (!Number.isFinite(recordId)) {
        setLoadError("Invalid record id.");
        setLoading(false);
        return;
      }
      if (!opts.silent) setLoading(true);
      setLoadError(null);
      setNotFound(false);
      try {
        const [rec, status, auditRows, evalRows] = await Promise.all([
          records.get(recordId),
          documents.status(recordId),
          audit.list(recordId, 50),
          records.evaluations(recordId),
        ]);
        setRecord(rec);
        setDocStatus(status);
        setAuditEntries(auditRows);
        setEvaluationsRaw(evalRows);
        const wf = await workflows.get(rec.workflow_id);
        setWorkflow(wf);
      } catch (err) {
        if (err instanceof ApiError && err.status === 404) {
          setNotFound(true);
        } else if (err instanceof ApiError) {
          setLoadError(err.detail ?? "Failed to load record.");
        } else {
          setLoadError("Failed to load record.");
        }
      } finally {
        setLoading(false);
      }
    },
    [recordId]
  );

  useEffect(() => {
    refreshAll();
  }, [refreshAll]);

  const stagesById = useMemo(() => {
    const map = new Map<number, WorkflowStage>();
    workflow?.stages.forEach((s) => map.set(s.id, s));
    return map;
  }, [workflow]);

  const currentStage = record ? stagesById.get(record.current_stage_id) : undefined;

  // Derive initial decision view from persisted evaluation rows when no
  // fresh decision is available yet. This lets the user see blocking and
  // warning rules on page load without first clicking "Run evaluation".
  const derivedDecision: EvaluationDecision | null = useMemo(() => {
    if (decision) return decision;
    if (!record || evaluationsRaw.length === 0) return null;
    const violations: EvaluationIssue[] = [];
    const warnings: EvaluationIssue[] = [];
    for (const row of evaluationsRaw) {
      if (row.passed) continue;
      const ruleCode = `rule#${row.rule_id}`;
      const issue: EvaluationIssue = {
        rule_code: ruleCode,
        message: row.explanation ?? "No explanation recorded.",
        risk_applied: row.risk_applied,
      };
      if (row.action_applied === "block") violations.push(issue);
      else if (row.action_applied === "warn") warnings.push(issue);
    }
    return {
      can_progress: violations.length === 0,
      risk_score: record.risk_score,
      risk_band: record.risk_band,
      violations,
      warnings,
      summary:
        violations.length > 0
          ? `${violations.length} blocking issue(s); ${warnings.length} warning(s).`
          : warnings.length > 0
          ? `No blocking issues; ${warnings.length} warning(s).`
          : "All active rules passed in the last evaluation.",
    };
  }, [decision, evaluationsRaw, record]);

  async function handleEvaluate() {
    if (!record) return;
    setEvaluating(true);
    setFlash(null);
    try {
      const result = await records.evaluate(record.id);
      setDecision(result);
      await refreshAll({ silent: true });
      setFlash({
        kind: result.can_progress ? "success" : "info",
        text: result.can_progress
          ? `Evaluation complete — no blocking issues (risk ${result.risk_score} / ${result.risk_band}).`
          : `Evaluation complete — ${result.violations.length} blocking issue(s) (risk ${result.risk_score} / ${result.risk_band}).`,
      });
    } catch (err) {
      setFlash({
        kind: "error",
        text: err instanceof ApiError ? err.detail ?? err.message : "Evaluation failed.",
      });
    } finally {
      setEvaluating(false);
    }
  }

  async function handleTransition() {
    if (!record || targetStageId === "") return;
    setTransitioning(true);
    setFlash(null);
    try {
      const result = await records.transition(record.id, Number(targetStageId));
      setDecision(result.decision);
      await refreshAll({ silent: true });
      if (result.success) {
        const newStage = stagesById.get(result.updated_stage_id);
        setFlash({
          kind: "success",
          text: `Transition complete → ${newStage?.name ?? `stage #${result.updated_stage_id}`}.`,
        });
        setTargetStageId("");
      } else {
        setFlash({
          kind: "error",
          text: `Transition blocked: ${result.decision.summary}`,
        });
      }
    } catch (err) {
      setFlash({
        kind: "error",
        text:
          err instanceof ApiError ? err.detail ?? err.message : "Transition failed.",
      });
    } finally {
      setTransitioning(false);
    }
  }

  async function handleVerify(doc: DocumentRead) {
    setBusyDocId(doc.id);
    setFlash(null);
    try {
      await documents.verify(doc.id);
      await refreshAll({ silent: true });
      setFlash({
        kind: "success",
        text: `Verified ${DOCUMENT_TYPE_LABELS[doc.document_type]}.`,
      });
    } catch (err) {
      setFlash({
        kind: "error",
        text: err instanceof ApiError ? err.detail ?? err.message : "Verification failed.",
      });
    } finally {
      setBusyDocId(null);
    }
  }

  async function handleReject(doc: DocumentRead) {
    const reason = typeof window !== "undefined" ? window.prompt("Rejection reason (optional):") : null;
    setBusyDocId(doc.id);
    setFlash(null);
    try {
      await documents.reject(doc.id, reason ?? undefined);
      await refreshAll({ silent: true });
      setFlash({
        kind: "info",
        text: `Rejected ${DOCUMENT_TYPE_LABELS[doc.document_type]}.`,
      });
    } catch (err) {
      setFlash({
        kind: "error",
        text: err instanceof ApiError ? err.detail ?? err.message : "Rejection failed.",
      });
    } finally {
      setBusyDocId(null);
    }
  }

  if (loading && !record) {
    return (
      <div className="space-y-6">
        <Link href="/records" className="text-sm text-text-muted hover:text-text">
          ← All records
        </Link>
        <LoadingSkeleton rows={10} />
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="space-y-6">
        <Link href="/records" className="text-sm text-text-muted hover:text-text">
          ← All records
        </Link>
        <EmptyState
          title="Record not found"
          description="This record does not exist or is not visible to your organization."
        />
      </div>
    );
  }

  if (!record) {
    return (
      <div className="space-y-4">
        {loadError ? <ErrorBanner message={loadError} /> : null}
        <Link href="/records" className="text-sm text-text-muted hover:text-text">
          ← All records
        </Link>
      </div>
    );
  }

  const availableTargets = (workflow?.stages ?? [])
    .slice()
    .sort((a, b) => a.order_index - b.order_index)
    .filter((s) => s.id !== record.current_stage_id);

  const documentsByType: Record<string, DocumentRead[]> = {};
  for (const d of docStatus?.documents ?? []) {
    const key = d.document_type;
    (documentsByType[key] ||= []).push(d);
  }

  const requiredList = (docStatus?.required_types ?? []) as DocumentType[];
  const otherTypes = Object.keys(documentsByType).filter(
    (t) => !requiredList.includes(t as DocumentType)
  ) as DocumentType[];

  const countsBlock = docStatus
    ? [
        { label: "Required", value: docStatus.required_types.length },
        { label: "Satisfied", value: docStatus.satisfied_types.length },
        { label: "Present", value: docStatus.present_types.length },
        { label: "Missing", value: docStatus.missing_types.length },
        { label: "Rejected", value: docStatus.rejected_types.length },
      ]
    : [];

  return (
    <div className="space-y-6">
      {loadError ? <ErrorBanner message={loadError} /> : null}

      <Link href="/records" className="text-sm text-text-muted hover:text-text">
        ← All records
      </Link>

      {/* Header block */}
      <header className="space-y-3">
        <div>
          <h1 className="text-2xl font-semibold text-text">
            {record.subject_full_name}
          </h1>
          {record.external_reference ? (
            <div className="text-sm text-text-muted">
              Reference{" "}
              <span className="font-mono text-text">{record.external_reference}</span>
            </div>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
          <div>
            <span className="field-label mr-2">Stage</span>
            <span className="font-medium">
              {currentStage?.name ?? `Stage #${record.current_stage_id}`}
            </span>
          </div>
          <div>
            <span className="field-label mr-2">Status</span>
            <StatusBadge status={record.status} />
          </div>
          <div>
            <span className="field-label mr-2">Risk</span>
            <RiskBadge band={record.risk_band} score={record.risk_score} size="md" />
          </div>
          <div>
            <span className="field-label mr-2">Assigned</span>
            <span className="font-medium">
              {record.assigned_user_id !== null
                ? `User #${record.assigned_user_id}`
                : "Unassigned"}
            </span>
          </div>
          <div>
            <span className="field-label mr-2">Subject DOB</span>
            <span className="font-medium">{formatDate(record.subject_dob)}</span>
          </div>
        </div>
      </header>

      {/* Action bar */}
      <section className="panel p-4">
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            className="btn-primary"
            onClick={handleEvaluate}
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
                setTargetStageId(e.target.value === "" ? "" : Number(e.target.value))
              }
              disabled={transitioning}
            >
              <option value="">Select stage…</option>
              {availableTargets.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="btn-secondary"
              onClick={handleTransition}
              disabled={transitioning || targetStageId === ""}
            >
              {transitioning ? "Attempting…" : "Attempt transition"}
            </button>
          </div>

          <button
            type="button"
            className="btn-secondary ml-auto"
            onClick={() => refreshAll({ silent: true })}
            disabled={evaluating || transitioning}
          >
            Refresh
          </button>
        </div>

        {flash ? (
          <div
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

      {/* Evaluation summary */}
      <Panel
        title="Evaluation"
        description="Most recent decision for this record."
      >
        {!derivedDecision ? (
          <EmptyState
            title="No evaluation yet"
            description="Run evaluation to see which rules pass, warn, or block right now."
          >
            <button
              type="button"
              className="btn-primary mt-3"
              onClick={handleEvaluate}
              disabled={evaluating}
            >
              {evaluating ? "Evaluating…" : "Run evaluation"}
            </button>
          </EmptyState>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="panel-muted p-3">
                <div className="field-label">Can progress</div>
                <div
                  className={`mt-1 text-lg font-semibold ${
                    derivedDecision.can_progress
                      ? "text-severity-low"
                      : "text-severity-critical"
                  }`}
                >
                  {derivedDecision.can_progress ? "Yes" : "No"}
                </div>
              </div>
              <div className="panel-muted p-3">
                <div className="field-label">Risk score</div>
                <div className="mt-1 text-lg font-semibold tabular-nums">
                  {derivedDecision.risk_score}
                </div>
              </div>
              <div className="panel-muted p-3">
                <div className="field-label">Risk band</div>
                <div className="mt-1">
                  <RiskBadge
                    band={derivedDecision.risk_band}
                    score={derivedDecision.risk_score}
                    size="md"
                  />
                </div>
              </div>
            </div>
            <p className="text-sm text-text-muted">{derivedDecision.summary}</p>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <IssueList
                title="Blocking issues"
                tone="critical"
                emptyLabel="No blocking issues."
                issues={derivedDecision.violations}
              />
              <IssueList
                title="Warnings"
                tone="warning"
                emptyLabel="No active warnings."
                issues={derivedDecision.warnings}
              />
            </div>
          </div>
        )}
      </Panel>

      {/* Workflow timeline */}
      <Panel
        title="Workflow"
        description={workflow?.name ?? "Workflow stages in order."}
      >
        {workflow ? (
          <ol className="flex flex-wrap items-center gap-2">
            {workflow.stages
              .slice()
              .sort((a, b) => a.order_index - b.order_index)
              .map((stage, idx, arr) => {
                const isCurrent = stage.id === record.current_stage_id;
                const isPast =
                  currentStage !== undefined &&
                  stage.order_index < currentStage.order_index;
                const pillCls = isCurrent
                  ? "border-accent bg-accent/10 text-accent"
                  : isPast
                  ? "border-surface-border bg-surface-muted/50 text-text-muted"
                  : "border-surface-border bg-transparent text-text";
                return (
                  <li key={stage.id} className="flex items-center gap-2">
                    <span
                      className={`inline-flex items-center rounded-md border px-2.5 py-1 text-xs font-medium ${pillCls}`}
                    >
                      <span className="mr-1.5 text-[0.65rem] uppercase tracking-wide opacity-70">
                        {stage.order_index + 1}
                      </span>
                      {stage.name}
                    </span>
                    {idx < arr.length - 1 ? (
                      <span className="text-text-subtle">›</span>
                    ) : null}
                  </li>
                );
              })}
          </ol>
        ) : (
          <LoadingSkeleton rows={1} />
        )}
      </Panel>

      {/* Document evidence */}
      <Panel
        title="Document evidence"
        description="Required documents for this record's current stage and their status."
      >
        {!docStatus ? (
          <LoadingSkeleton rows={3} />
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
              {countsBlock.map((c) => (
                <div key={c.label} className="panel-muted p-3 text-center">
                  <div className="field-label">{c.label}</div>
                  <div className="mt-1 text-xl font-semibold tabular-nums">
                    {c.value}
                  </div>
                </div>
              ))}
            </div>

            {requiredList.length === 0 ? (
              <EmptyState title="No document requirements at this stage." />
            ) : (
              <div className="space-y-3">
                {requiredList.map((type) => {
                  const satisfied = docStatus.satisfied_types.includes(type);
                  const rejected = docStatus.rejected_types.includes(type);
                  const attached = documentsByType[type] ?? [];
                  return (
                    <div
                      key={type}
                      className="rounded-md border border-surface-border bg-surface-muted/30"
                    >
                      <div className="flex items-center justify-between border-b border-surface-border px-3 py-2">
                        <div className="font-medium">
                          {DOCUMENT_TYPE_LABELS[type]}
                        </div>
                        {satisfied ? (
                          <span className="chip border-severity-low/40 bg-severity-low/15 text-severity-low">
                            Satisfied
                          </span>
                        ) : rejected && attached.every((d) => d.status === "rejected") ? (
                          <span className="chip border-severity-critical/40 bg-severity-critical/15 text-severity-critical">
                            Rejected — resubmit
                          </span>
                        ) : attached.length > 0 ? (
                          <span className="chip border-severity-high/40 bg-severity-high/15 text-severity-high">
                            Awaiting verification
                          </span>
                        ) : (
                          <span className="chip border-severity-critical/40 bg-severity-critical/15 text-severity-critical">
                            Missing
                          </span>
                        )}
                      </div>
                      {attached.length === 0 ? (
                        <div className="px-3 py-2 text-sm text-text-muted">
                          No document attached yet.
                        </div>
                      ) : (
                        <DocumentRows
                          docs={attached}
                          busyDocId={busyDocId}
                          onVerify={handleVerify}
                          onReject={handleReject}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {otherTypes.length > 0 ? (
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-text-muted">
                  Other documents
                </h3>
                {otherTypes.map((type) => (
                  <div
                    key={type}
                    className="rounded-md border border-surface-border bg-surface-muted/30"
                  >
                    <div className="flex items-center justify-between border-b border-surface-border px-3 py-2">
                      <div className="font-medium">
                        {DOCUMENT_TYPE_LABELS[type] ?? titleCase(type)}
                      </div>
                      <span className="chip border-surface-border bg-transparent text-text-muted">
                        Not required
                      </span>
                    </div>
                    <DocumentRows
                      docs={documentsByType[type] ?? []}
                      busyDocId={busyDocId}
                      onVerify={handleVerify}
                      onReject={handleReject}
                    />
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        )}
      </Panel>

      {/* Audit trail */}
      <Panel
        title="Audit trail"
        description="Most recent first. Canonical event payloads."
      >
        {auditEntries.length === 0 ? (
          <EmptyState title="No audit entries yet." />
        ) : (
          <ol className="space-y-2">
            {auditEntries.map((entry) => (
              <AuditRow key={entry.id} entry={entry} />
            ))}
          </ol>
        )}
      </Panel>
    </div>
  );
}

// ---------------------------------------------------------------------------

function IssueList({
  title,
  tone,
  emptyLabel,
  issues,
}: {
  title: string;
  tone: "critical" | "warning";
  emptyLabel: string;
  issues: EvaluationIssue[];
}) {
  const wrapperCls =
    tone === "critical"
      ? "border-severity-critical/30 bg-severity-critical/5"
      : "border-severity-high/30 bg-severity-high/5";
  const chipCls =
    tone === "critical"
      ? "border-severity-critical/40 bg-severity-critical/15 text-severity-critical"
      : "border-severity-high/40 bg-severity-high/15 text-severity-high";
  return (
    <div className={`rounded-md border ${wrapperCls}`}>
      <div className="border-b border-surface-border px-3 py-2 text-sm font-semibold">
        {title}
      </div>
      {issues.length === 0 ? (
        <div className="px-3 py-2 text-sm text-text-muted">{emptyLabel}</div>
      ) : (
        <ul className="divide-y divide-surface-border">
          {issues.map((issue, idx) => (
            <li key={`${issue.rule_code}-${idx}`} className="flex items-start gap-3 px-3 py-2">
              <div className="min-w-0 flex-1">
                <div className="font-mono text-xs text-text">
                  {issue.rule_code}
                </div>
                <div className="text-sm text-text-muted">{issue.message}</div>
              </div>
              {issue.risk_applied > 0 ? (
                <span className={`chip ${chipCls}`}>+{issue.risk_applied}</span>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function DocumentRows({
  docs,
  busyDocId,
  onVerify,
  onReject,
}: {
  docs: DocumentRead[];
  busyDocId: number | null;
  onVerify: (doc: DocumentRead) => void;
  onReject: (doc: DocumentRead) => void;
}) {
  return (
    <ul className="divide-y divide-surface-border">
      {docs.map((doc) => {
        const busy = busyDocId === doc.id;
        return (
          <li key={doc.id} className="grid gap-2 px-3 py-2 text-sm sm:grid-cols-[auto_1fr_auto]">
            <div className="flex items-center gap-2">
              <DocumentStatusChip status={doc.status} />
              <span className="truncate">{doc.label ?? "—"}</span>
            </div>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-xs text-text-muted sm:grid-cols-3">
              <div>
                <dt className="field-label">Uploaded</dt>
                <dd>{formatDateTime(doc.created_at)}</dd>
              </div>
              <div>
                <dt className="field-label">Verified</dt>
                <dd>
                  {doc.verified_at
                    ? `${formatDateTime(doc.verified_at)}${
                        doc.verified_by_user_id
                          ? ` · User #${doc.verified_by_user_id}`
                          : ""
                      }`
                    : "—"}
                </dd>
              </div>
              <div>
                <dt className="field-label">Rejection</dt>
                <dd>
                  {doc.rejected_at
                    ? `${formatDateTime(doc.rejected_at)}${
                        doc.rejection_reason ? ` · ${doc.rejection_reason}` : ""
                      }`
                    : "—"}
                </dd>
              </div>
            </dl>
            <div className="flex items-center gap-2 sm:justify-end">
              {doc.status !== "verified" ? (
                <button
                  type="button"
                  className="btn-secondary text-xs"
                  onClick={() => onVerify(doc)}
                  disabled={busy}
                >
                  {busy ? "…" : "Verify"}
                </button>
              ) : null}
              {doc.status !== "rejected" ? (
                <button
                  type="button"
                  className="btn-danger text-xs"
                  onClick={() => onReject(doc)}
                  disabled={busy}
                >
                  {busy ? "…" : "Reject"}
                </button>
              ) : null}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

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
