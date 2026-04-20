"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useEffect, useRef, useState } from "react";

import { DocumentStatusChip } from "@/components/DocumentStatusChip";
import { MoreHorizontal, type LucideIcon } from "@/components/icons";
import { DURATION_MICRO, EASE_OUT } from "@/lib/motion";
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
    doc.mime_type && PREVIEWABLE_MIME_TYPES.has(doc.mime_type),
  );

  const overflow: OverflowAction[] = [];
  if (stored) {
    overflow.push({
      label: "Integrity check",
      onClick: () => onIntegrityCheck(doc),
    });
  }
  overflow.push({
    label: "Delete",
    tone: "danger",
    onClick: () => onDelete(doc),
  });

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
                  ? "text-verified"
                  : "text-severity-critical"
              }
            >
              {integrity.is_match ? (
                <>
                  Match ·{" "}
                  <span className="mono">
                    {integrity.actual_content_hash?.slice(0, 12)}…
                  </span>
                </>
              ) : integrity.has_stored_content ? (
                `Mismatch · ${integrity.message}`
              ) : (
                `Missing content · ${integrity.message}`
              )}
              <span className="ml-2 text-text-subtle">
                checked {formatDateTime(integrity.checked_at)}
              </span>
            </dd>
          </div>
        ) : null}
      </dl>

      <div className="flex flex-wrap items-center gap-2 sm:justify-end">
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
        <OverflowMenu actions={overflow} disabled={busy} />
      </div>
    </li>
  );
}


interface OverflowAction {
  label: string;
  onClick: () => void;
  icon?: LucideIcon;
  tone?: "default" | "danger";
}

function OverflowMenu({
  actions,
  disabled,
}: {
  actions: OverflowAction[];
  disabled: boolean;
}) {
  const reduce = useReducedMotion();
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const firstItem = menuRef.current?.querySelector<HTMLButtonElement>("button");
    firstItem?.focus();

    function onMouseDown(e: MouseEvent) {
      const target = e.target as Node;
      if (
        menuRef.current?.contains(target) ||
        buttonRef.current?.contains(target)
      ) {
        return;
      }
      setOpen(false);
    }

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        setOpen(false);
        buttonRef.current?.focus();
      } else if (e.key === "Tab") {
        setOpen(false);
      } else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        const items = Array.from(
          menuRef.current?.querySelectorAll<HTMLButtonElement>(
            'button[role="menuitem"]',
          ) ?? [],
        );
        if (items.length === 0) return;
        const idx = items.indexOf(document.activeElement as HTMLButtonElement);
        const next =
          e.key === "ArrowDown"
            ? (idx + 1) % items.length
            : (idx - 1 + items.length) % items.length;
        items[next]?.focus();
      }
    }

    document.addEventListener("mousedown", onMouseDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="More actions"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-surface-border text-text-muted transition-colors hover:border-text-subtle hover:text-text focus:outline-none focus:ring-1 focus:ring-brand-400 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <MoreHorizontal size={14} aria-hidden />
      </button>
      <AnimatePresence>
        {open ? (
          <motion.div
            ref={menuRef}
            role="menu"
            initial={reduce ? false : { opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={reduce ? undefined : { opacity: 0, scale: 0.95 }}
            transition={
              reduce ? { duration: 0 } : { duration: DURATION_MICRO, ease: EASE_OUT }
            }
            className="absolute right-0 top-full z-10 mt-1 min-w-[10rem] origin-top-right overflow-hidden rounded-md border border-surface-border bg-surface-panel py-1 shadow-lg shadow-black/40"
          >
            {actions.map((action) => (
              <button
                key={action.label}
                type="button"
                role="menuitem"
                onClick={() => {
                  action.onClick();
                  setOpen(false);
                  buttonRef.current?.focus();
                }}
                className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs transition-colors hover:bg-surface-muted focus:bg-surface-muted focus:outline-none ${
                  action.tone === "danger"
                    ? "text-severity-critical"
                    : "text-text"
                }`}
              >
                {action.icon ? <action.icon size={12} aria-hidden /> : null}
                {action.label}
              </button>
            ))}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
