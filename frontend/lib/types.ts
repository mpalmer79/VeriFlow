// Shared frontend types that mirror the backend API contract.
// Keep these in sync with backend/app/schemas/* and model enums.

export type UserRole = "admin" | "intake_coordinator" | "reviewer" | "manager";

export type RecordStatus =
  | "draft"
  | "in_progress"
  | "blocked"
  | "ready"
  | "closed";

export type RiskBand = "low" | "moderate" | "high" | "critical";

export type InsuranceStatus =
  | "unknown"
  | "pending"
  | "verified"
  | "uninsured_acknowledged"
  | "invalid";

export type ConsentStatus = "not_provided" | "partial" | "signed" | "expired";

export type MedicalHistoryStatus = "not_started" | "incomplete" | "complete";

export type DocumentStatus = "uploaded" | "verified" | "rejected" | "expired";

export type DocumentType =
  | "photo_id"
  | "insurance_card"
  | "consent_form"
  | "guardian_authorization"
  | "medical_history_form"
  | "other";

export type RuleActionApplied = "none" | "warn" | "block";

export interface UserPublic {
  id: number;
  organization_id: number;
  email: string;
  full_name: string;
  role: UserRole;
  is_active: boolean;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

export interface RecordRead {
  id: number;
  organization_id: number;
  workflow_id: number;
  current_stage_id: number;
  assigned_user_id: number | null;
  assigned_user_name: string | null;
  external_reference: string | null;
  subject_full_name: string;
  subject_dob: string | null;
  status: RecordStatus;
  insurance_status: InsuranceStatus;
  consent_status: ConsentStatus;
  medical_history_status: MedicalHistoryStatus;
  identity_verified: boolean;
  guardian_authorization_signed: boolean;
  allergy_info_provided: boolean;
  insurance_in_network: boolean | null;
  risk_score: number;
  risk_band: RiskBand;
  version: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface EvaluationIssue {
  rule_code: string;
  message: string;
  risk_applied: number;
}

export interface EvaluationDecision {
  can_progress: boolean;
  risk_score: number;
  risk_band: RiskBand;
  violations: EvaluationIssue[];
  warnings: EvaluationIssue[];
  summary: string;
}

export interface RuleEvaluationRow {
  id: number;
  rule_id: number;
  rule_code: string;
  rule_name: string;
  passed: boolean;
  action_applied: RuleActionApplied;
  risk_applied: number;
  explanation: string | null;
  evaluated_at: string;
}

export interface TransitionResponse {
  success: boolean;
  from_stage_id: number;
  target_stage_id: number;
  updated_stage_id: number;
  record_version: number;
  decision: EvaluationDecision;
  message: string;
}

export interface DocumentRead {
  id: number;
  record_id: number;
  document_type: DocumentType;
  label: string | null;
  has_stored_content: boolean;
  original_filename: string | null;
  mime_type: string | null;
  size_bytes: number | null;
  content_hash: string | null;
  verified_content_hash: string | null;
  expires_at: string | null;
  status: DocumentStatus;
  notes: string | null;
  verified_by_user_id: number | null;
  verified_at: string | null;
  rejected_by_user_id: number | null;
  rejected_at: string | null;
  rejection_reason: string | null;
  created_at: string;
  updated_at: string;
}

export interface IntegrityCheckResult {
  document_id: number;
  has_stored_content: boolean;
  expected_content_hash: string | null;
  actual_content_hash: string | null;
  is_match: boolean;
  checked_at: string;
  message: string;
}

export interface RecordIntegritySummary {
  record_id: number;
  checked_at: string;
  documents: IntegrityCheckResult[];
}

export interface EvidenceSummary {
  record_id: number;
  documents_total: number;
  upload_backed: number;
  metadata_only: number;
  verified: number;
  rejected: number;
  integrity_checkable: number;
  missing_content: number;
  stored_bytes: number;
}

export interface SignedAccessGrant {
  token: string;
  expires_at: string;
  ttl_seconds: number;
  document_id: number;
  disposition: "inline" | "attachment";
  url: string;
}

export interface AuditChainReport {
  organization_id: number | null;
  checked: number;
  ok: boolean;
  broken_entries: { audit_id: number; stored_entry_hash: string; recomputed_entry_hash: string }[];
  broken_links: { audit_id: number; stored_previous_hash: string | null; expected_previous_hash: string | null }[];
}

export interface StorageInventoryReport {
  managed_files_on_disk: number;
  total_bytes_on_disk: number;
  referenced_by_organization: number;
  total_bytes_referenced_by_organization: number;
  dangling_references_in_organization: number;
  orphaned_files: number;
}

export interface StorageCleanupReport {
  dry_run: boolean;
  files_examined: number;
  orphaned_found: number;
  orphaned_deleted: number;
  bytes_reclaimed: number;
  errors: number;
}

export interface DocumentStatusResponse {
  required_types: DocumentType[];
  present_types: DocumentType[];
  verified_types: DocumentType[];
  satisfied_types: DocumentType[];
  missing_types: DocumentType[];
  rejected_types: DocumentType[];
  documents: DocumentRead[];
}

export interface WorkflowStage {
  id: number;
  name: string;
  slug: string;
  order_index: number;
  is_terminal: boolean;
}

export interface AuditEntry {
  id: number;
  action: string;
  entity_type: string;
  entity_id: number | null;
  payload: Record<string, unknown> | null;
  created_at: string;
  actor_user_id: number | null;
}
