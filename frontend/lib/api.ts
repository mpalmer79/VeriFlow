// Thin, typed HTTP client for the VeriFlow API.
// All calls go through `request` so auth, base URL, abort handling,
// and error decoding stay consistent. Components should import the
// typed wrappers below rather than calling `fetch` directly.

import type {
  AuditChainReport,
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
  StorageCleanupReport,
  StorageInventoryReport,
  TokenResponse,
  TransitionResponse,
  UserPublic,
  WorkflowStage,
} from "./types";
import { readToken } from "./auth";

const API_BASE_URL =
  (typeof process !== "undefined" && process.env.NEXT_PUBLIC_API_BASE_URL) || "";

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
  signal?: AbortSignal;
}

function authHeaders(): Record<string, string> {
  // During the cookie-auth rollout window the backend accepts either
  // Authorization: Bearer or the `veriflow.session` cookie. The cookie
  // rides along automatically because every fetch uses
  // `credentials: "include"`. The Bearer header is a fallback for
  // callers that still store a token client-side (legacy integrations,
  // demo role-switch flow).
  const token = readToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  if (!API_BASE_URL) {
    throw new ApiError(
      0,
      "Frontend is not configured: NEXT_PUBLIC_API_BASE_URL is empty. Set it to the backend's public URL + /api and rebuild.",
    );
  }

  const headers: Record<string, string> = {};
  if (!options.skipAuth) Object.assign(headers, authHeaders());

  const isFormData =
    typeof FormData !== "undefined" && options.body instanceof FormData;
  if (!isFormData) headers["Content-Type"] = "application/json";

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: options.method ?? "GET",
    headers,
    body:
      options.body === undefined
        ? undefined
        : isFormData
          ? (options.body as FormData)
          : JSON.stringify(options.body),
    cache: "no-store",
    credentials: "include",
    signal: options.signal,
  });

  if (response.status === 204) return undefined as T;

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
    if (response.status === 401 && !options.skipAuth) {
      // Stale session: clear cached credentials so the next render
      // does not keep showing the signed-in shell against a dead
      // backend session. The hard redirect lands the operator on
      // /login with next= set to wherever they were trying to go.
      clearStaleSession();
    }
    throw new ApiError(response.status, detail, detail);
  }

  return parsed as T;
}

function clearStaleSession() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem("veriflow.token");
    window.localStorage.removeItem("veriflow.user");
  } catch {
    // localStorage may be unavailable.
  }
  const current = window.location.pathname + window.location.search;
  // /login and / are already anonymous surfaces; don't loop through
  // a redirect on them.
  if (current === "/login" || current === "/" || current === "/enter") return;
  const next = encodeURIComponent(current);
  window.location.replace(`/login?next=${next}`);
}

// --- auth ---------------------------------------------------------------

export const auth = {
  login: (email: string, password: string) =>
    request<TokenResponse>("/auth/login", {
      method: "POST",
      body: { email, password },
      skipAuth: true,
    }),
  me: (signal?: AbortSignal) =>
    request<UserPublic>("/auth/me", { signal }),
  logout: () => request<void>("/auth/logout", { method: "POST" }),
  rotate: () => request<TokenResponse>("/auth/rotate", { method: "POST" }),
};

// --- records ------------------------------------------------------------

export const records = {
  list: (
    params?: { limit?: number; offset?: number },
    signal?: AbortSignal,
  ) => {
    const query = new URLSearchParams();
    if (params?.limit !== undefined) query.set("limit", String(params.limit));
    if (params?.offset !== undefined) query.set("offset", String(params.offset));
    const suffix = query.toString() ? `?${query}` : "";
    return request<RecordRead[]>(`/records${suffix}`, { signal });
  },
  get: (id: number, signal?: AbortSignal) =>
    request<RecordRead>(`/records/${id}`, { signal }),
  evaluate: (id: number) =>
    request<EvaluationDecision>(`/records/${id}/evaluate`, { method: "POST" }),
  evaluations: (id: number, signal?: AbortSignal) =>
    request<RuleEvaluationRow[]>(`/records/${id}/evaluations`, { signal }),
  decision: (id: number, signal?: AbortSignal) =>
    request<EvaluationDecision>(`/records/${id}/decision`, { signal }),
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
      { method: "DELETE" },
    ),
  evidenceSummary: (id: number, signal?: AbortSignal) =>
    request<EvidenceSummary>(`/records/${id}/evidence-summary`, { signal }),
};

// --- documents ----------------------------------------------------------

export const documents = {
  list: (recordId: number, signal?: AbortSignal) =>
    request<DocumentRead[]>(`/records/${recordId}/documents`, { signal }),
  register: (
    recordId: number,
    body: {
      document_type: DocumentType;
      label?: string;
      notes?: string;
    },
  ) =>
    request<DocumentRead>(`/records/${recordId}/documents`, {
      method: "POST",
      body,
    }),
  upload: (
    recordId: number,
    file: File,
    metadata: {
      document_type: DocumentType;
      label?: string;
      notes?: string;
    },
    signal?: AbortSignal,
  ): Promise<DocumentRead> => {
    // One typed entry point: request<T> branches on FormData body, so
    // the upload path shares the same auth, error decoding, abort
    // plumbing, and credentials posture as every other call.
    const form = new FormData();
    form.append("file", file, file.name);
    form.append("document_type", metadata.document_type);
    if (metadata.label) form.append("label", metadata.label);
    if (metadata.notes) form.append("notes", metadata.notes);
    return request<DocumentRead>(`/records/${recordId}/documents/upload`, {
      method: "POST",
      body: form,
      signal,
    });
  },
  status: (recordId: number, signal?: AbortSignal) =>
    request<DocumentStatusResponse>(`/records/${recordId}/document-status`, {
      signal,
    }),
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
      { method: "POST" },
    ),
  recordIntegritySummary: (recordId: number, signal?: AbortSignal) =>
    request<RecordIntegritySummary>(
      `/records/${recordId}/integrity-summary`,
      { signal },
    ),
  contentUrl: (documentId: number) =>
    `${API_BASE_URL}/documents/${documentId}/content`,
  signedAccess: (
    documentId: number,
    body: { disposition?: "inline" | "attachment"; ttl_seconds?: number } = {},
  ) =>
    request<SignedAccessGrant>(
      `/documents/${documentId}/signed-access`,
      { method: "POST", body },
    ),
  signedContentUrl: (grant: SignedAccessGrant) =>
    `${API_BASE_URL}${grant.url}`,
  fetchContent: async (
    documentId: number,
    opts: { disposition?: "inline" | "attachment"; signal?: AbortSignal } = {},
  ): Promise<Blob> => {
    const headers: Record<string, string> = { ...authHeaders() };
    const params = new URLSearchParams();
    if (opts.disposition) params.set("disposition", opts.disposition);
    const qs = params.toString() ? `?${params}` : "";
    const response = await fetch(
      `${API_BASE_URL}/documents/${documentId}/content${qs}`,
      {
        headers,
        cache: "no-store",
        credentials: "include",
        signal: opts.signal,
      },
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
  list: (recordId: number, limit = 100, signal?: AbortSignal) =>
    request<AuditEntry[]>(`/records/${recordId}/audit?limit=${limit}`, {
      signal,
    }),
  verifyChain: (signal?: AbortSignal) =>
    request<AuditChainReport>("/audit/verify", { signal }),
  storageInventory: (signal?: AbortSignal) =>
    request<StorageInventoryReport>("/audit/storage-inventory", { signal }),
  storageCleanup: (dryRun: boolean) =>
    request<StorageCleanupReport>(
      `/audit/storage-cleanup?dry_run=${dryRun ? "true" : "false"}`,
      { method: "POST" },
    ),
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
  get: (id: number, signal?: AbortSignal) =>
    request<WorkflowRead>(`/workflows/${id}`, { signal }),
};

export { API_BASE_URL };
