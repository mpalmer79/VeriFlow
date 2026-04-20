import type { FormEvent } from "react";

import { DOCUMENT_TYPE_LABELS } from "@/lib/format";
import type { DocumentType } from "@/lib/types";

interface UploadFormProps {
  documentType: DocumentType;
  label: string;
  file: File | null;
  uploading: boolean;
  onTypeChange: (t: DocumentType) => void;
  onLabelChange: (v: string) => void;
  onFileChange: (f: File | null) => void;
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
}

export function UploadForm({
  documentType,
  label,
  file,
  uploading,
  onTypeChange,
  onLabelChange,
  onFileChange,
  onSubmit,
}: UploadFormProps) {
  return (
    <form
      onSubmit={onSubmit}
      className="grid gap-3 rounded-md border border-surface-border bg-surface-muted/30 p-3 sm:grid-cols-[1fr_1fr_1fr_auto] sm:items-end"
    >
      <label className="flex flex-col gap-1">
        <span className="field-label">Type</span>
        <select
          className="input"
          value={documentType}
          onChange={(e) => onTypeChange(e.target.value as DocumentType)}
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
          value={label}
          onChange={(e) => onLabelChange(e.target.value)}
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
          onChange={(e) => onFileChange(e.target.files?.[0] ?? null)}
          disabled={uploading}
        />
      </label>
      <button
        type="submit"
        className="btn-primary"
        disabled={uploading || file === null}
      >
        {uploading ? "Uploading…" : "Upload evidence"}
      </button>
      <p className="text-xs text-text-subtle sm:col-span-4">
        Accepted formats: PDF, PNG, JPEG. Server hashes on ingest and
        re-hashes on verify / integrity check.
      </p>
    </form>
  );
}
