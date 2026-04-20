import { EmptyState } from "@/components/EmptyState";
import { LoadingSkeleton } from "@/components/LoadingSkeleton";
import { Panel } from "@/components/Panel";
import { DOCUMENT_TYPE_LABELS, titleCase } from "@/lib/format";
import type {
  DocumentRead,
  DocumentStatusResponse,
  DocumentType,
  EvidenceSummary,
  IntegrityCheckResult,
} from "@/lib/types";

import { DocumentRows } from "./DocumentRows";
import { EvidenceSummaryStrip } from "./EvidenceSummaryStrip";
import { UploadForm } from "./UploadForm";


interface DocumentEvidencePanelProps {
  docStatus: DocumentStatusResponse | null;
  summary: EvidenceSummary | null;

  upload: {
    documentType: DocumentType;
    label: string;
    file: File | null;
    uploading: boolean;
    onTypeChange: (t: DocumentType) => void;
    onLabelChange: (v: string) => void;
    onFileChange: (f: File | null) => void;
    onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
  };

  rows: {
    busyDocId: number | null;
    previewLoadingDocId?: number | null;
    integrityResults: Record<number, IntegrityCheckResult>;
    onVerify: (doc: DocumentRead) => void;
    onReject: (doc: DocumentRead) => void;
    onDelete: (doc: DocumentRead) => void;
    onIntegrityCheck: (doc: DocumentRead) => void;
    onDownload: (doc: DocumentRead) => void;
    onPreview: (doc: DocumentRead, trigger: HTMLButtonElement | null) => void;
  };
}


export function DocumentEvidencePanel({
  docStatus,
  summary,
  upload,
  rows,
}: DocumentEvidencePanelProps) {
  if (!docStatus) {
    return (
      <Panel title="Document evidence">
        <LoadingSkeleton rows={3} />
      </Panel>
    );
  }

  const documentsByType: Record<string, DocumentRead[]> = {};
  for (const d of docStatus.documents) {
    (documentsByType[d.document_type] ||= []).push(d);
  }

  const requiredList = docStatus.required_types as DocumentType[];
  const otherTypes = (Object.keys(documentsByType) as DocumentType[]).filter(
    (t) => !requiredList.includes(t)
  );

  return (
    <Panel
      title="Document evidence"
      description="Requirements in scope for this record's current stage, plus any attached documents."
    >
      <div className="space-y-5">
        <EvidenceSummaryStrip summary={summary} />

        <UploadForm
          documentType={upload.documentType}
          label={upload.label}
          file={upload.file}
          uploading={upload.uploading}
          onTypeChange={upload.onTypeChange}
          onLabelChange={upload.onLabelChange}
          onFileChange={upload.onFileChange}
          onSubmit={upload.onSubmit}
        />

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
                  <header className="flex items-center justify-between border-b border-surface-border px-3 py-2">
                    <div className="font-medium">
                      {DOCUMENT_TYPE_LABELS[type]}
                    </div>
                    {satisfied ? (
                      <span className="chip border-severity-low/40 bg-severity-low/15 text-severity-low">
                        Satisfied
                      </span>
                    ) : rejected &&
                      attached.every((d) => d.status === "rejected") ? (
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
                  </header>
                  {attached.length === 0 ? (
                    <div className="px-3 py-2 text-sm text-text-muted">
                      No document attached yet.
                    </div>
                  ) : (
                    <DocumentRows docs={attached} {...rows} />
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
                <header className="flex items-center justify-between border-b border-surface-border px-3 py-2">
                  <div className="font-medium">
                    {DOCUMENT_TYPE_LABELS[type] ?? titleCase(type)}
                  </div>
                  <span className="chip border-surface-border bg-transparent text-text-muted">
                    Not required
                  </span>
                </header>
                <DocumentRows
                  docs={documentsByType[type] ?? []}
                  {...rows}
                />
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </Panel>
  );
}
