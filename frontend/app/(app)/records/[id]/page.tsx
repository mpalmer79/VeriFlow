"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { ApiError, audit, documents, records, workflows } from "@/lib/api";
import type {
  AuditEntry,
  DocumentRead,
  DocumentStatusResponse,
  DocumentType,
  EvaluationDecision,
  EvaluationIssue,
  EvidenceSummary,
  IntegrityCheckResult,
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
import { SeverityPanel } from "@/components/SeverityPanel";
import { StageBadge } from "@/components/StageBadge";
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
  const [uploading, setUploading] = useState(false);
  const [uploadType, setUploadType] = useState<DocumentType>("photo_id");
  const [uploadLabel, setUploadLabel] = useState("");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [integrityResults, setIntegrityResults] = useState<
    Record<number, IntegrityCheckResult>
  >({});
  const [evidenceSummary, setEvidenceSummary] = useState<EvidenceSummary | null>(null);
  const [preview, setPreview] = useState<{
    src: string;
    mimeType: string;
    filename: string;
    documentId: number;
    cleanup: () => void;
  } | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const previewTriggerRef = useRef<HTMLButtonElement | null>(null);

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
        const [rec, status, auditRows, evalRows, summary] = await Promise.all([
          records.get(recordId),
          documents.status(recordId),
          audit.list(recordId, 50),
          records.evaluations(recordId),
          records.evidenceSummary(recordId).catch(() => null),
        ]);
        setRecord(rec);
        setDocStatus(status);
        setAuditEntries(auditRows);
        setEvaluationsRaw(evalRows);
        setEvidenceSummary(summary);
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
      const issue: EvaluationIssue = {
        rule_code: row.rule_code,
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
          ? `${violations.length} blocking issue${violations.length === 1 ? "" : "s"}, ${warnings.length} warning${warnings.length === 1 ? "" : "s"}.`
          : warnings.length > 0
          ? `No blocking issues. ${warnings.length} warning${warnings.length === 1 ? "" : "s"} outstanding.`
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
      const result = await records.transition(
        record.id,
        Number(targetStageId),
        record.version
      );
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

  async function handleUpload(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!record || !uploadFile || uploading) return;
    setUploading(true);
    setFlash(null);
    try {
      await documents.upload(record.id, uploadFile, {
        document_type: uploadType,
        label: uploadLabel || undefined,
      });
      setUploadFile(null);
      setUploadLabel("");
      await refreshAll({ silent: true });
      setFlash({
        kind: "success",
        text: `Uploaded ${DOCUMENT_TYPE_LABELS[uploadType]}.`,
      });
    } catch (err) {
      setFlash({
        kind: "error",
        text: err instanceof ApiError ? err.detail ?? err.message : "Upload failed.",
      });
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(doc: DocumentRead) {
    if (typeof window !== "undefined") {
      const confirmed = window.confirm(
        `Delete ${DOCUMENT_TYPE_LABELS[doc.document_type]}? This removes the document and any stored content.`
      );
      if (!confirmed) return;
    }
    setBusyDocId(doc.id);
    setFlash(null);
    try {
      await documents.remove(doc.id);
      setIntegrityResults((prev) => {
        const next = { ...prev };
        delete next[doc.id];
        return next;
      });
      await refreshAll({ silent: true });
      setFlash({
        kind: "info",
        text: `Deleted ${DOCUMENT_TYPE_LABELS[doc.document_type]}.`,
      });
    } catch (err) {
      setFlash({
        kind: "error",
        text: err instanceof ApiError ? err.detail ?? err.message : "Deletion failed.",
      });
    } finally {
      setBusyDocId(null);
    }
  }

  async function handleIntegrityCheck(doc: DocumentRead) {
    setBusyDocId(doc.id);
    setFlash(null);
    try {
      const result = await documents.integrityCheck(doc.id);
      setIntegrityResults((prev) => ({ ...prev, [doc.id]: result }));
    } catch (err) {
      setFlash({
        kind: "error",
        text:
          err instanceof ApiError
            ? err.detail ?? err.message
            : "Integrity check failed.",
      });
    } finally {
      setBusyDocId(null);
    }
  }

  async function handleDownload(doc: DocumentRead) {
    setBusyDocId(doc.id);
    setFlash(null);
    try {
      const grant = await documents.signedAccess(doc.id, {
        disposition: "attachment",
      });
      const url = documents.signedContentUrl(grant);
      const a = document.createElement("a");
      a.href = url;
      a.download =
        doc.original_filename ||
        `document-${doc.id}.${(doc.mime_type ?? "application/octet-stream").split("/").pop()}`;
      a.rel = "noopener";
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (err) {
      setFlash({
        kind: "error",
        text: err instanceof ApiError ? err.detail ?? err.message : "Download failed.",
      });
    } finally {
      setBusyDocId(null);
    }
  }

  async function handlePreview(
    doc: DocumentRead,
    trigger?: HTMLButtonElement | null
  ) {
    if (!doc.has_stored_content) return;
    previewTriggerRef.current = trigger ?? null;
    setPreviewLoading(true);
    setFlash(null);
    try {
      const grant = await documents.signedAccess(doc.id, {
        disposition: "inline",
      });
      if (preview) preview.cleanup();
      const src = documents.signedContentUrl(grant);
      setPreview({
        src,
        mimeType: doc.mime_type ?? "application/octet-stream",
        filename: doc.original_filename ?? `document-${doc.id}`,
        documentId: doc.id,
        cleanup: () => {
          // Signed URL expires on its own; nothing to revoke.
        },
      });
    } catch (err) {
      setFlash({
        kind: "error",
        text: err instanceof ApiError ? err.detail ?? err.message : "Preview failed.",
      });
    } finally {
      setPreviewLoading(false);
    }
  }

  function closePreview() {
    if (preview) preview.cleanup();
    setPreview(null);
    const trigger = previewTriggerRef.current;
    previewTriggerRef.current = null;
    if (trigger) {
      // Return focus to the button that opened the modal.
      requestAnimationFrame(() => trigger.focus());
    }
  }

  useEffect(() => {
    return () => {
      if (preview) preview.cleanup();
    };
  }, [preview]);

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
          <div className="flex items-center gap-2">
            <span className="field-label">Stage</span>
            {currentStage ? (
              <StageBadge
                name={currentStage.name}
                orderIndex={currentStage.order_index}
                tone="current"
                size="md"
              />
            ) : (
              <span className="font-medium">Stage #{record.current_stage_id}</span>
            )}
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
            <span className="field-label mr-2">Assigned to</span>
            <span className="font-medium">
              {record.assigned_user_name ?? "Unassigned"}
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
        description="Latest rule decision and risk. Replaced on every run."
      >
        {!derivedDecision ? (
          <EmptyState
            title="No evaluation on file"
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
              <SeverityPanel
                tone="critical"
                title="Blocking issues"
                emptyLabel="No blocking issues. All block-level rules passed."
                issues={derivedDecision.violations}
              />
              <SeverityPanel
                tone="warning"
                title="Warnings"
                emptyLabel="No active warnings."
                issues={derivedDecision.warnings}
              />
            </div>
          </div>
        )}
      </Panel>

      {/* Workflow timeline */}
      <Panel
        title="Workflow progress"
        description={workflow?.name ?? "Stages in order, current stage highlighted."}
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
        description="Requirements in scope for this record's current stage, plus any attached documents."
      >
        {evidenceSummary ? (
          <div className="mb-4 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
            <EvidenceSummaryCell
              label="Upload-backed"
              value={evidenceSummary.upload_backed}
            />
            <EvidenceSummaryCell
              label="Metadata only"
              value={evidenceSummary.metadata_only}
            />
            <EvidenceSummaryCell
              label="Verified"
              value={evidenceSummary.verified}
            />
            <EvidenceSummaryCell
              label="Stored bytes"
              value={formatBytes(evidenceSummary.stored_bytes)}
            />
          </div>
        ) : null}

        <form
          onSubmit={handleUpload}
          className="mb-4 grid gap-3 rounded-md border border-surface-border bg-surface-muted/30 p-3 sm:grid-cols-[1fr_1fr_1fr_auto] sm:items-end"
        >
          <label className="flex flex-col gap-1">
            <span className="field-label">Type</span>
            <select
              className="input"
              value={uploadType}
              onChange={(e) => setUploadType(e.target.value as DocumentType)}
              disabled={uploading}
            >
              {(Object.keys(DOCUMENT_TYPE_LABELS) as DocumentType[]).map((t) => (
                <option key={t} value={t}>
                  {DOCUMENT_TYPE_LABELS[t]}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="field-label">Label (optional)</span>
            <input
              className="input"
              value={uploadLabel}
              onChange={(e) => setUploadLabel(e.target.value)}
              placeholder="e.g. Front of driver's license"
              disabled={uploading}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="field-label">File</span>
            <input
              type="file"
              className="input"
              accept="application/pdf,image/png,image/jpeg"
              onChange={(e) => setUploadFile(e.target.files?.[0] ?? null)}
              disabled={uploading}
            />
          </label>
          <button
            type="submit"
            className="btn-primary"
            disabled={uploading || uploadFile === null}
          >
            {uploading ? "Uploading…" : "Upload evidence"}
          </button>
          <p className="sm:col-span-4 text-xs text-text-subtle">
            Accepted formats: PDF, PNG, JPEG. Server re-hashes on verify and
            integrity check.
          </p>
        </form>

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
              <EmptyState
                title="No documents required at this stage"
                description="Requirements apply at later stages in this workflow."
              />
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
                          integrityResults={integrityResults}
                          onVerify={handleVerify}
                          onReject={handleReject}
                          onDelete={handleDelete}
                          onIntegrityCheck={handleIntegrityCheck}
                          onDownload={handleDownload}
                          onPreview={handlePreview}
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
                      integrityResults={integrityResults}
                      onVerify={handleVerify}
                      onReject={handleReject}
                      onDelete={handleDelete}
                      onIntegrityCheck={handleIntegrityCheck}
                      onDownload={handleDownload}
                      onPreview={handlePreview}
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
        description="Append-only. Most recent events first."
      >
        {auditEntries.length === 0 ? (
          <EmptyState
            title="No audit history yet"
            description="Audit events will appear here after the first evaluation, transition, or document change."
          />
        ) : (
          <ol className="space-y-2">
            {auditEntries.map((entry) => (
              <AuditRow key={entry.id} entry={entry} />
            ))}
          </ol>
        )}
      </Panel>

      {preview ? (
        <PreviewOverlay preview={preview} onClose={closePreview} />
      ) : previewLoading ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 text-sm text-text-muted">
          Loading preview…
        </div>
      ) : null}
    </div>
  );
}


function PreviewOverlay({
  preview,
  onClose,
}: {
  preview: {
    src: string;
    mimeType: string;
    filename: string;
    documentId: number;
  };
  onClose: () => void;
}) {
  const isImage = preview.mimeType.startsWith("image/");
  const isPdf = preview.mimeType === "application/pdf";
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const closeBtnRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    closeBtnRef.current?.focus();
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key !== "Tab") return;
      const node = dialogRef.current;
      if (!node) return;
      const focusable = Array.from(
        node.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])'
        )
      ).filter((el) => !el.hasAttribute("aria-hidden"));
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="preview-title"
        className="relative flex h-full max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-md border border-surface-border bg-surface-panel shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between gap-3 border-b border-surface-border px-4 py-2">
          <div id="preview-title" className="truncate text-sm font-medium">
            {preview.filename}
          </div>
          <button
            ref={closeBtnRef}
            type="button"
            className="btn-secondary text-xs"
            onClick={onClose}
            aria-label="Close preview"
          >
            Close
          </button>
        </header>
        <div className="flex-1 overflow-auto bg-surface-muted/60">
          {isImage ? (
            <div className="flex min-h-full items-center justify-center p-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={preview.src}
                alt={preview.filename}
                className="max-h-full max-w-full object-contain"
              />
            </div>
          ) : isPdf ? (
            <iframe
              title={preview.filename}
              src={preview.src}
              className="h-full w-full"
            />
          ) : (
            <div className="flex h-full items-center justify-center p-8 text-sm text-text-muted">
              Preview is not supported for this content type. Use Download
              instead.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------

const PREVIEWABLE_MIME_TYPES = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
]);


function DocumentRows({
  docs,
  busyDocId,
  integrityResults,
  onVerify,
  onReject,
  onDelete,
  onIntegrityCheck,
  onDownload,
  onPreview,
}: {
  docs: DocumentRead[];
  busyDocId: number | null;
  integrityResults: Record<number, IntegrityCheckResult>;
  onVerify: (doc: DocumentRead) => void;
  onReject: (doc: DocumentRead) => void;
  onDelete: (doc: DocumentRead) => void;
  onIntegrityCheck: (doc: DocumentRead) => void;
  onDownload: (doc: DocumentRead) => void;
  onPreview: (doc: DocumentRead, trigger: HTMLButtonElement | null) => void;
}) {
  return (
    <ul className="divide-y divide-surface-border">
      {docs.map((doc) => {
        const busy = busyDocId === doc.id;
        const stored = doc.has_stored_content;
        const integrity = integrityResults[doc.id];
        return (
          <li key={doc.id} className="grid gap-2 px-3 py-2 text-sm sm:grid-cols-[auto_1fr_auto]">
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <DocumentStatusChip status={doc.status} />
                <span className="truncate">{doc.label ?? "—"}</span>
              </div>
              <span
                className={`chip text-[11px] ${
                  stored
                    ? "border-accent/40 bg-accent/10 text-accent"
                    : "border-surface-border bg-transparent text-text-muted"
                }`}
                title={stored ? "Real evidence bytes on file" : "Metadata-only registration — no bytes on disk"}
              >
                {stored ? "Evidence stored" : "Metadata only"}
              </span>
            </div>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-xs text-text-muted sm:grid-cols-3">
              <div>
                <dt className="field-label">Uploaded</dt>
                <dd>
                  {formatDateTime(doc.created_at)}
                  {doc.original_filename ? ` · ${doc.original_filename}` : ""}
                </dd>
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
              {integrity ? (
                <div className="sm:col-span-3">
                  <dt className="field-label">Integrity</dt>
                  <dd
                    className={
                      integrity.is_match
                        ? "text-severity-low"
                        : "text-severity-critical"
                    }
                  >
                    {integrity.is_match
                      ? `Match · ${integrity.actual_content_hash?.slice(0, 12)}…`
                      : integrity.has_stored_content
                      ? `Mismatch · ${integrity.message}`
                      : `Missing content · ${integrity.message}`}
                    <span className="ml-2 text-text-subtle">
                      checked {formatDateTime(integrity.checked_at)}
                    </span>
                  </dd>
                </div>
              ) : null}
            </dl>
            <div className="flex flex-wrap items-center gap-2 sm:justify-end">
              {stored && doc.status !== "verified" ? (
                <button
                  type="button"
                  className="btn-secondary text-xs"
                  onClick={() => onVerify(doc)}
                  disabled={busy}
                  title="Re-hash stored bytes and mark verified on match"
                >
                  {busy ? "…" : "Verify"}
                </button>
              ) : null}
              {stored ? (
                <button
                  type="button"
                  className="btn-secondary text-xs"
                  onClick={() => onIntegrityCheck(doc)}
                  disabled={busy}
                  title="Compare stored bytes against the ingest hash"
                >
                  {busy ? "…" : "Integrity check"}
                </button>
              ) : null}
              {stored && doc.mime_type && PREVIEWABLE_MIME_TYPES.has(doc.mime_type) ? (
                <button
                  type="button"
                  className="btn-secondary text-xs"
                  onClick={(e) => onPreview(doc, e.currentTarget)}
                  disabled={busy}
                  title="Preview the stored evidence in an overlay"
                >
                  {busy ? "…" : "Preview"}
                </button>
              ) : null}
              {stored ? (
                <button
                  type="button"
                  className="btn-secondary text-xs"
                  onClick={() => onDownload(doc)}
                  disabled={busy}
                  title="Download the stored evidence"
                >
                  {busy ? "…" : "Download"}
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
              <button
                type="button"
                className="btn-secondary text-xs"
                onClick={() => onDelete(doc)}
                disabled={busy}
                title="Remove the document record and any stored content"
              >
                {busy ? "…" : "Delete"}
              </button>
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

function EvidenceSummaryCell({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="panel-muted p-2 text-center">
      <div className="field-label">{label}</div>
      <div className="mt-1 text-sm font-semibold tabular-nums">{value}</div>
    </div>
  );
}


function formatBytes(size: number): string {
  if (!Number.isFinite(size) || size <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  let value = size;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit++;
  }
  return `${value.toFixed(unit === 0 ? 0 : 1)} ${units[unit]}`;
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
