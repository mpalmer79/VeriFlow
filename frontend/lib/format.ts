import type { DocumentType, RecordStatus, RiskBand } from "./types";

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return "—";
  try {
    const d = new Date(value);
    return d.toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return value;
  }
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  try {
    const d = new Date(value);
    return d.toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "2-digit",
    });
  } catch {
    return value;
  }
}

export function titleCase(value: string): string {
  return value
    .replace(/[_-]+/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export const DOCUMENT_TYPE_LABELS: Record<DocumentType, string> = {
  photo_id: "Photo ID",
  insurance_card: "Insurance Card",
  consent_form: "Consent Form",
  guardian_authorization: "Guardian Authorization",
  medical_history_form: "Medical History Form",
  other: "Other",
};

export const RECORD_STATUS_LABELS: Record<RecordStatus, string> = {
  draft: "Draft",
  in_progress: "In Progress",
  blocked: "Blocked",
  ready: "Ready",
  closed: "Closed",
};

export const RISK_BAND_LABELS: Record<RiskBand, string> = {
  low: "Low",
  moderate: "Moderate",
  high: "High",
  critical: "Critical",
};


export function formatBytes(size: number | null | undefined): string {
  if (!Number.isFinite(size as number) || (size ?? 0) <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  let value = size as number;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit++;
  }
  return `${value.toFixed(unit === 0 ? 0 : 1)} ${units[unit]}`;
}
