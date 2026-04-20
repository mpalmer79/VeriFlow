import { DocumentStatusChip } from "@/components/DocumentStatusChip";
import { formatDateTime } from "@/lib/format";
import type { DocumentRead, IntegrityCheckResult } from "@/lib/types";


export const PREVIEWABLE_MIME_TYPES = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
]);


interface DocumentRowsProps {
  docs: DocumentRead[];
  busyDocId: number | null;
  integrityResults: Record<number, IntegrityCheckResult>;
  onVerify: (doc: DocumentRead) => void;
  onReject: (doc: DocumentRead) => void;
  onDelete: (doc: DocumentRead) => void;
  onIntegrityCheck: (doc: DocumentRead) => void;
  onDownload: (doc: DocumentRead) => void;
  onPreview: (doc: DocumentRead, trigger: HTMLButtonElement | null) => void;
}


export function DocumentRows({
  docs,
  busyDocId,
  integrityResults,
  onVerify,
  onReject,
  onDelete,
  onIntegrityCheck,
  onDownload,
  onPreview,
}: DocumentRowsProps) {
  return (
    <ul className="divide-y divide-surface-border">
      {docs.map((doc) => (
        <DocumentRow
          key={doc.id}
          doc={doc}
          busy={busyDocId === doc.id}
          integrity={integrityResults[doc.id]}
          onVerify={onVerify}
          onReject={onReject}
          onDelete={onDelete}
          onIntegrityCheck={onIntegrityCheck}
          onDownload={onDownload}
          onPreview={onPreview}
        />
      ))}
    </ul>
  );
}


function DocumentRow({
  doc,
  busy,
  integrity,
  onVerify,
  onReject,
  onDelete,
  onIntegrityCheck,
  onDownload,
  onPreview,
}: {
  doc: DocumentRead;
  busy: boolean;
  integrity: IntegrityCheckResult | undefined;
  onVerify: (doc: DocumentRead) => void;
  onReject: (doc: DocumentRead) => void;
  onDelete: (doc: DocumentRead) => void;
  onIntegrityCheck: (doc: DocumentRead) => void;
  onDownload: (doc: DocumentRead) => void;
  onPreview: (doc: DocumentRead, trigger: HTMLButtonElement | null) => void;
}) {
  const stored = doc.has_stored_content;
  const previewable = Boolean(
    doc.mime_type && PREVIEWABLE_MIME_TYPES.has(doc.mime_type)
  );
  return (
    <li className="grid gap-3 px-3 py-3 text-sm sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)_auto]">
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <DocumentStatusChip status={doc.status} />
          <span className="truncate font-medium">{doc.label ?? "—"}</span>
        </div>
        <span
          className={`chip text-[11px] ${
            stored
              ? "border-accent/40 bg-accent/10 text-accent"
              : "border-surface-border bg-transparent text-text-muted"
          }`}
          title={
            stored
              ? "Real evidence bytes on file"
              : "Metadata-only registration — no bytes on disk"
          }
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
        {stored && previewable ? (
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
}
