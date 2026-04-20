// Thin, typed HTTP client for the VeriFlow API.
// All calls go through `request` so auth, base URL, and error handling are
// consistent. Components should import the typed wrappers below rather than
// calling `fetch` directly.

import type {
  AuditEntry,
  DocumentRead,
  DocumentStatusResponse,
  DocumentType,
  EvaluationDecision,
  EvidenceSummary,
  IntegrityCheckResult,
  RecordIntegritySummary,
  RecordRead,
  RuleEvaluationRow,
  SignedAccessGrant,
  TokenResponse,
  TransitionResponse,
  UserPublic,
  WorkflowStage,
} from "./types";
import { readToken } from "./auth";

const API_BASE_URL =
  (typeof process !== "undefined" && process.env.NEXT_PUBLIC_API_BASE_URL) ||
  "http://localhost:8000/api";

export class ApiError extends Error {
  status: number;
  detail?: string;
  constructor(status: number, message: string, detail?: string) {
    super(message);
    this.status = status;
    this.detail = detail;
  }
}

interface RequestOptions {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  body?: unknown;
  skipAuth?: boolean;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (!options.skipAuth) {
    const token = readToken();
    if (token) headers["Authorization"] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: options.method ?? "GET",
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    cache: "no-store",
  });

  if (response.status === 204) {
    return undefined as T;
  }

  const text = await response.text();
  const parsed = text ? (JSON.parse(text) as unknown) : undefined;

  if (!response.ok) {
    const detail =
      typeof parsed === "object" &&
      parsed !== null &&
      "detail" in parsed &&
      typeof (parsed as { detail: unknown }).detail === "string"
        ? ((parsed as { detail: string }).detail)
        : response.statusText;
    throw new ApiError(response.status, detail, detail);
  }

  return parsed as T;
}

// --- auth ---------------------------------------------------------------

export const auth = {
  login: (email: string, password: string) =>
    request<TokenResponse>("/auth/login", {
      method: "POST",
      body: { email, password },
      skipAuth: true,
    }),
  me: () => request<UserPublic>("/auth/me"),
};

// --- records ------------------------------------------------------------

export const records = {
  list: (params?: { limit?: number; offset?: number }) => {
    const query = new URLSearchParams();
    if (params?.limit !== undefined) query.set("limit", String(params.limit));
    if (params?.offset !== undefined) query.set("offset", String(params.offset));
    const suffix = query.toString() ? `?${query}` : "";
    return request<RecordRead[]>(`/records${suffix}`);
  },
  get: (id: number) => request<RecordRead>(`/records/${id}`),
  evaluate: (id: number) =>
    request<EvaluationDecision>(`/records/${id}/evaluate`, { method: "POST" }),
  evaluations: (id: number) =>
    request<RuleEvaluationRow[]>(`/records/${id}/evaluations`),
  transition: (id: number, targetStageId: number, expectedVersion: number) =>
    request<TransitionResponse>(`/records/${id}/transition`, {
      method: "POST",
      body: {
        target_stage_id: targetStageId,
        expected_version: expectedVersion,
      },
    }),
  remove: (id: number, expectedVersion: number) =>
    request<void>(
      `/records/${id}?expected_version=${encodeURIComponent(expectedVersion)}`,
      { method: "DELETE" }
    ),
  evidenceSummary: (id: number) =>
    request<EvidenceSummary>(`/records/${id}/evidence-summary`),
};

// --- documents ----------------------------------------------------------

async function uploadMultipart(
  recordId: number,
  file: File,
  metadata: {
    document_type: DocumentType;
    label?: string;
    notes?: string;
  }
): Promise<DocumentRead> {
  const form = new FormData();
  form.append("file", file, file.name);
  form.append("document_type", metadata.document_type);
  if (metadata.label) form.append("label", metadata.label);
  if (metadata.notes) form.append("notes", metadata.notes);
  const headers: Record<string, string> = {};
  const token = readToken();
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const response = await fetch(
    `${API_BASE_URL}/records/${recordId}/documents/upload`,
    {
      method: "POST",
      headers,
      body: form,
      cache: "no-store",
    }
  );
  const text = await response.text();
  const parsed = text ? (JSON.parse(text) as unknown) : undefined;
  if (!response.ok) {
    const detail =
      typeof parsed === "object" &&
      parsed !== null &&
      "detail" in parsed &&
      typeof (parsed as { detail: unknown }).detail === "string"
        ? (parsed as { detail: string }).detail
        : response.statusText;
    throw new ApiError(response.status, detail, detail);
  }
  return parsed as DocumentRead;
}

export const documents = {
  list: (recordId: number) =>
    request<DocumentRead[]>(`/records/${recordId}/documents`),
  register: (
    recordId: number,
    body: {
      document_type: DocumentType;
      label?: string;
      notes?: string;
    }
  ) =>
    request<DocumentRead>(`/records/${recordId}/documents`, {
      method: "POST",
      body,
    }),
  upload: uploadMultipart,
  status: (recordId: number) =>
    request<DocumentStatusResponse>(`/records/${recordId}/document-status`),
  verify: (documentId: number, notes?: string) =>
    request<DocumentRead>(`/documents/${documentId}/verify`, {
      method: "POST",
      body: notes !== undefined ? { notes } : {},
    }),
  reject: (documentId: number, reason?: string) =>
    request<DocumentRead>(`/documents/${documentId}/reject`, {
      method: "POST",
      body: reason !== undefined ? { reason } : {},
    }),
  remove: (documentId: number) =>
    request<void>(`/documents/${documentId}`, { method: "DELETE" }),
  integrityCheck: (documentId: number) =>
    request<IntegrityCheckResult>(
      `/documents/${documentId}/integrity-check`,
      { method: "POST" }
    ),
  recordIntegritySummary: (recordId: number) =>
    request<RecordIntegritySummary>(
      `/records/${recordId}/integrity-summary`
    ),
  // The `/content` endpoint is plain HTTP because browsers handle the
  // blob download directly. We expose a URL builder + auth header so a
  // caller can trigger a download without inlining fetch logic.
  contentUrl: (documentId: number) =>
    `${API_BASE_URL}/documents/${documentId}/content`,
  signedAccess: (
    documentId: number,
    body: { disposition?: "inline" | "attachment"; ttl_seconds?: number } = {}
  ) =>
    request<SignedAccessGrant>(
      `/documents/${documentId}/signed-access`,
      { method: "POST", body }
    ),
  signedContentUrl: (grant: SignedAccessGrant) =>
    `${API_BASE_URL}${grant.url}`,
  fetchContent: async (
    documentId: number,
    opts: { disposition?: "inline" | "attachment" } = {}
  ): Promise<Blob> => {
    const headers: Record<string, string> = {};
    const token = readToken();
    if (token) headers["Authorization"] = `Bearer ${token}`;
    const params = new URLSearchParams();
    if (opts.disposition) params.set("disposition", opts.disposition);
    const qs = params.toString() ? `?${params}` : "";
    const response = await fetch(
      `${API_BASE_URL}/documents/${documentId}/content${qs}`,
      { headers, cache: "no-store" }
    );
    if (!response.ok) {
      const text = await response.text();
      let detail = response.statusText;
      try {
        const parsed = JSON.parse(text) as { detail?: string };
        if (parsed && typeof parsed.detail === "string") detail = parsed.detail;
      } catch {
        // body was not JSON
      }
      throw new ApiError(response.status, detail, detail);
    }
    return response.blob();
  },
};

// --- audit ---------------------------------------------------------------

export const audit = {
  list: (recordId: number, limit = 100) =>
    request<AuditEntry[]>(`/records/${recordId}/audit?limit=${limit}`),
};

// --- workflows ----------------------------------------------------------

interface WorkflowRead {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  stages: WorkflowStage[];
}

export const workflows = {
  get: (id: number) => request<WorkflowRead>(`/workflows/${id}`),
};

export { API_BASE_URL };
