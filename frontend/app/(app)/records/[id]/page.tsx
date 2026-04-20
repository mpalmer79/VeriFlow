"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { ConfirmDialog } from "@/components/ConfirmDialog";
import { EmptyState } from "@/components/EmptyState";
import { ErrorBanner } from "@/components/ErrorBanner";
import { LoadingSkeleton } from "@/components/LoadingSkeleton";
import { ActionBar } from "@/components/record-detail/ActionBar";
import { AuditTrail } from "@/components/record-detail/AuditTrail";
import { DocumentEvidencePanel } from "@/components/record-detail/DocumentEvidencePanel";
import { EvaluationPanel } from "@/components/record-detail/EvaluationPanel";
import {
  PreviewOverlay,
  PreviewTarget,
} from "@/components/record-detail/PreviewOverlay";
import { RecordHeader } from "@/components/record-detail/RecordHeader";
import { WorkflowTimeline } from "@/components/record-detail/WorkflowTimeline";
import { useToast } from "@/components/ui/Toast";
import { ApiError, audit, documents, records, workflows } from "@/lib/api";
import { DOCUMENT_TYPE_LABELS } from "@/lib/format";
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


interface WorkflowData {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  stages: WorkflowStage[];
}


export default function RecordDetailPage() {
  const toast = useToast();
  const params = useParams<{ id: string }>();
  const recordId = Number(params.id);

  const [record, setRecord] = useState<RecordRead | null>(null);
  const [docStatus, setDocStatus] = useState<DocumentStatusResponse | null>(null);
  const [auditEntries, setAuditEntries] = useState<AuditEntry[]>([]);
  const [evaluationsRaw, setEvaluationsRaw] = useState<RuleEvaluationRow[]>([]);
  const [workflow, setWorkflow] = useState<WorkflowData | null>(null);
  const [decision, setDecision] = useState<EvaluationDecision | null>(null);
  const [evidenceSummary, setEvidenceSummary] = useState<EvidenceSummary | null>(null);

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);

  const [evaluating, setEvaluating] = useState(false);
  const [transitioning, setTransitioning] = useState(false);
  const [targetStageId, setTargetStageId] = useState<number | "">("");
  const [busyDocId, setBusyDocId] = useState<number | null>(null);

  const [uploading, setUploading] = useState(false);
  const [uploadType, setUploadType] = useState<DocumentType>("photo_id");
  const [uploadLabel, setUploadLabel] = useState("");
  const [uploadFile, setUploadFile] = useState<File | null>(null);

  const [integrityResults, setIntegrityResults] = useState<
    Record<number, IntegrityCheckResult>
  >({});

  const [preview, setPreview] = useState<PreviewTarget | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const previewTriggerRef = useRef<HTMLButtonElement | null>(null);

  const [rejectTarget, setRejectTarget] = useState<DocumentRead | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<DocumentRead | null>(null);

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
    
    try {
      const result = await records.evaluate(record.id);
      setDecision(result);
      await refreshAll({ silent: true });
      toast.push({
        kind: result.can_progress ? "success" : "info",
        text: result.can_progress
          ? `Evaluation complete — no blocking issues (risk ${result.risk_score} / ${result.risk_band}).`
          : `Evaluation complete — ${result.violations.length} blocking issue(s) (risk ${result.risk_score} / ${result.risk_band}).`,
      });
    } catch (err) {
      toast.push({
        kind: "error",
        text:
          err instanceof ApiError ? err.detail ?? err.message : "Evaluation failed.",
      });
    } finally {
      setEvaluating(false);
    }
  }

  async function handleTransition() {
    if (!record || targetStageId === "") return;
    setTransitioning(true);
    
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
        toast.push({
          kind: "success",
          text: `Transition complete → ${newStage?.name ?? `stage #${result.updated_stage_id}`}.`,
        });
        setTargetStageId("");
      } else {
        toast.push({
          kind: "error",
          text: `Transition blocked: ${result.decision.summary}`,
        });
      }
    } catch (err) {
      toast.push({
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
    
    try {
      await documents.verify(doc.id);
      await refreshAll({ silent: true });
      toast.push({
        kind: "success",
        text: `Verified ${DOCUMENT_TYPE_LABELS[doc.document_type]}.`,
      });
    } catch (err) {
      toast.push({
        kind: "error",
        text:
          err instanceof ApiError ? err.detail ?? err.message : "Verification failed.",
      });
    } finally {
      setBusyDocId(null);
    }
  }

  function handleReject(doc: DocumentRead) {
    setRejectReason("");
    setRejectTarget(doc);
  }

  async function confirmReject() {
    if (!rejectTarget) return;
    const doc = rejectTarget;
    setBusyDocId(doc.id);
    
    try {
      await documents.reject(doc.id, rejectReason.trim() || undefined);
      setRejectTarget(null);
      setRejectReason("");
      await refreshAll({ silent: true });
      toast.push({
        kind: "info",
        text: `Rejected ${DOCUMENT_TYPE_LABELS[doc.document_type]}.`,
      });
    } catch (err) {
      toast.push({
        kind: "error",
        text:
          err instanceof ApiError ? err.detail ?? err.message : "Rejection failed.",
      });
    } finally {
      setBusyDocId(null);
    }
  }

  async function handleUpload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!record || !uploadFile || uploading) return;
    setUploading(true);
    
    try {
      await documents.upload(record.id, uploadFile, {
        document_type: uploadType,
        label: uploadLabel || undefined,
      });
      setUploadFile(null);
      setUploadLabel("");
      await refreshAll({ silent: true });
      toast.push({
        kind: "success",
        text: `Uploaded ${DOCUMENT_TYPE_LABELS[uploadType]}.`,
      });
    } catch (err) {
      toast.push({
        kind: "error",
        text: err instanceof ApiError ? err.detail ?? err.message : "Upload failed.",
      });
    } finally {
      setUploading(false);
    }
  }

  function handleDelete(doc: DocumentRead) {
    setDeleteTarget(doc);
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    const doc = deleteTarget;
    setBusyDocId(doc.id);
    
    try {
      await documents.remove(doc.id);
      setIntegrityResults((prev) => {
        const next = { ...prev };
        delete next[doc.id];
        return next;
      });
      setDeleteTarget(null);
      await refreshAll({ silent: true });
      toast.push({
        kind: "info",
        text: `Deleted ${DOCUMENT_TYPE_LABELS[doc.document_type]}.`,
      });
    } catch (err) {
      toast.push({
        kind: "error",
        text: err instanceof ApiError ? err.detail ?? err.message : "Deletion failed.",
      });
    } finally {
      setBusyDocId(null);
    }
  }

  async function handleIntegrityCheck(doc: DocumentRead) {
    setBusyDocId(doc.id);
    
    try {
      const result = await documents.integrityCheck(doc.id);
      setIntegrityResults((prev) => ({ ...prev, [doc.id]: result }));
    } catch (err) {
      toast.push({
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
      toast.push({
        kind: "error",
        text: err instanceof ApiError ? err.detail ?? err.message : "Download failed.",
      });
    } finally {
      setBusyDocId(null);
    }
  }

  async function handlePreview(
    doc: DocumentRead,
    trigger: HTMLButtonElement | null
  ) {
    if (!doc.has_stored_content) return;
    previewTriggerRef.current = trigger;
    setPreviewLoading(true);
    
    try {
      const grant = await documents.signedAccess(doc.id, {
        disposition: "inline",
      });
      setPreview({
        src: documents.signedContentUrl(grant),
        mimeType: doc.mime_type ?? "application/octet-stream",
        filename: doc.original_filename ?? `document-${doc.id}`,
        documentId: doc.id,
      });
    } catch (err) {
      toast.push({
        kind: "error",
        text: err instanceof ApiError ? err.detail ?? err.message : "Preview failed.",
      });
    } finally {
      setPreviewLoading(false);
    }
  }

  function closePreview() {
    setPreview(null);
    const trigger = previewTriggerRef.current;
    previewTriggerRef.current = null;
    if (trigger) requestAnimationFrame(() => trigger.focus());
  }

  if (loading && !record) {
    return (
      <div className="space-y-6">
        <Link
          href="/records"
          className="text-sm text-text-muted hover:text-text"
        >
          ← All records
        </Link>
        <LoadingSkeleton rows={10} />
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="space-y-6">
        <Link
          href="/records"
          className="text-sm text-text-muted hover:text-text"
        >
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
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {loadError ? <ErrorBanner message={loadError} /> : null}

      <RecordHeader record={record} currentStage={currentStage} />

      <ActionBar
        stages={workflow?.stages ?? []}
        currentStageId={record.current_stage_id}
        targetStageId={targetStageId}
        onTargetChange={setTargetStageId}
        onEvaluate={handleEvaluate}
        onTransition={handleTransition}
        onRefresh={() => refreshAll({ silent: true })}
        evaluating={evaluating}
        transitioning={transitioning}
      />

      <EvaluationPanel
        decision={derivedDecision}
        onEvaluate={handleEvaluate}
        evaluating={evaluating}
      />

      <WorkflowTimeline
        workflowName={workflow?.name}
        stages={workflow?.stages ?? null}
        currentStageId={record.current_stage_id}
      />

      <DocumentEvidencePanel
        docStatus={docStatus}
        summary={evidenceSummary}
        upload={{
          documentType: uploadType,
          label: uploadLabel,
          file: uploadFile,
          uploading,
          onTypeChange: setUploadType,
          onLabelChange: setUploadLabel,
          onFileChange: setUploadFile,
          onSubmit: handleUpload,
        }}
        rows={{
          busyDocId,
          integrityResults,
          onVerify: handleVerify,
          onReject: handleReject,
          onDelete: handleDelete,
          onIntegrityCheck: handleIntegrityCheck,
          onDownload: handleDownload,
          onPreview: handlePreview,
        }}
      />

      <AuditTrail entries={auditEntries} />

      {preview ? (
        <PreviewOverlay preview={preview} onClose={closePreview} />
      ) : previewLoading ? (
        <div
          role="status"
          aria-live="polite"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 text-sm text-text-muted"
        >
          Loading preview…
        </div>
      ) : null}

      {rejectTarget ? (
        <ConfirmDialog
          title={`Reject ${DOCUMENT_TYPE_LABELS[rejectTarget.document_type]}?`}
          description="A rejection prevents the requirement from being satisfied until a new document is uploaded."
          confirmLabel="Reject document"
          tone="danger"
          busy={busyDocId === rejectTarget.id}
          inputLabel="Reason (optional)"
          inputValue={rejectReason}
          inputPlaceholder="e.g. Photo does not match subject"
          onInputChange={setRejectReason}
          onConfirm={confirmReject}
          onCancel={() => {
            if (busyDocId === rejectTarget.id) return;
            setRejectTarget(null);
            setRejectReason("");
          }}
        />
      ) : null}

      {deleteTarget ? (
        <ConfirmDialog
          title={`Delete ${DOCUMENT_TYPE_LABELS[deleteTarget.document_type]}?`}
          description="This removes the document metadata and any stored content. Audit history is retained."
          confirmLabel="Delete document"
          tone="danger"
          busy={busyDocId === deleteTarget.id}
          onConfirm={confirmDelete}
          onCancel={() => {
            if (busyDocId === deleteTarget.id) return;
            setDeleteTarget(null);
          }}
        />
      ) : null}
    </div>
  );
}
