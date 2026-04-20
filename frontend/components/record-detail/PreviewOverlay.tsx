"use client";

import { useEffect, useRef } from "react";


export interface PreviewTarget {
  src: string;
  mimeType: string;
  filename: string;
  documentId: number;
}


export function PreviewOverlay({
  preview,
  onClose,
}: {
  preview: PreviewTarget;
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
