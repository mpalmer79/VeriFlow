"use client";

import { useCallback, useEffect, useState } from "react";

import { ConfirmDialog } from "@/components/ConfirmDialog";
import { EmptyState } from "@/components/EmptyState";
import { ErrorBanner } from "@/components/ErrorBanner";
import { LoadingSkeleton } from "@/components/LoadingSkeleton";
import { Panel } from "@/components/Panel";
import { ApiError, audit } from "@/lib/api";
import { readUser } from "@/lib/auth";
import { formatBytes, formatDateTime } from "@/lib/format";
import type {
  AuditChainReport,
  StorageCleanupReport,
  StorageInventoryReport,
} from "@/lib/types";


type FlashKind = "success" | "info" | "error";


export default function OperationsPage() {
  const [authorized, setAuthorized] = useState<boolean | null>(null);

  const [chain, setChain] = useState<AuditChainReport | null>(null);
  const [inventory, setInventory] = useState<StorageInventoryReport | null>(null);
  const [lastCleanup, setLastCleanup] = useState<StorageCleanupReport | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [cleaning, setCleaning] = useState(false);
  const [dryRunning, setDryRunning] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [flash, setFlash] = useState<{ kind: FlashKind; text: string } | null>(null);

  useEffect(() => {
    const user = readUser();
    setAuthorized(Boolean(user && user.role === "admin"));
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [chainReport, inventoryReport] = await Promise.all([
        audit.verifyChain(),
        audit.storageInventory(),
      ]);
      setChain(chainReport);
      setInventory(inventoryReport);
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) {
        setAuthorized(false);
      } else {
        setLoadError(
          err instanceof ApiError ? err.detail ?? err.message : "Failed to load operations data."
        );
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authorized) void refresh();
    else if (authorized === false) setLoading(false);
  }, [authorized, refresh]);

  async function handleDryRun() {
    setDryRunning(true);
    setFlash(null);
    try {
      const report = await audit.storageCleanup(true);
      setLastCleanup(report);
      setFlash({
        kind: "info",
        text: `Dry run complete: ${report.orphaned_found} orphan(s) would be removed.`,
      });
    } catch (err) {
      setFlash({
        kind: "error",
        text: err instanceof ApiError ? err.detail ?? err.message : "Dry run failed.",
      });
    } finally {
      setDryRunning(false);
    }
  }

  async function confirmDestructiveCleanup() {
    setCleaning(true);
    setFlash(null);
    try {
      const report = await audit.storageCleanup(false);
      setLastCleanup(report);
      setConfirming(false);
      await refresh();
      setFlash({
        kind: "success",
        text: `Cleanup complete: removed ${report.orphaned_deleted} orphan(s), reclaimed ${formatBytes(
          report.bytes_reclaimed
        )}.`,
      });
    } catch (err) {
      setFlash({
        kind: "error",
        text:
          err instanceof ApiError ? err.detail ?? err.message : "Cleanup failed.",
      });
    } finally {
      setCleaning(false);
    }
  }

  if (authorized === null) {
    return <LoadingSkeleton rows={4} />;
  }

  if (!authorized) {
    return (
      <div className="space-y-6">
        <h1 className="text-xl font-semibold">Operations</h1>
        <EmptyState
          title="Admin access required"
          description="Operational tooling is limited to users with the admin role."
        />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-text">
            Operations
          </h1>
          <p className="mt-1 text-sm text-text-muted">
            Read-only audit chain verification and managed-storage inventory,
            plus a bounded cleanup workflow for orphaned evidence files.
          </p>
        </div>
        <button
          type="button"
          className="btn-secondary"
          onClick={() => void refresh()}
          disabled={loading}
        >
          {loading ? "Refreshing…" : "Refresh"}
        </button>
      </header>

      {loadError ? <ErrorBanner message={loadError} /> : null}

      {flash ? (
        <div
          role="status"
          className={`rounded-md border px-3 py-2 text-sm ${
            flash.kind === "success"
              ? "border-severity-low/40 bg-severity-low/10 text-severity-low"
              : flash.kind === "error"
              ? "border-severity-critical/40 bg-severity-critical/10 text-severity-critical"
              : "border-accent/40 bg-accent/10 text-accent"
          }`}
        >
          {flash.text}
        </div>
      ) : null}

      <Panel
        title="Audit chain"
        description="Recomputes every organization-scoped audit row and reports any broken entry hash or previous-hash link."
      >
        {loading && !chain ? (
          <LoadingSkeleton rows={3} />
        ) : chain ? (
          <div className="space-y-3 text-sm">
            <div className="flex flex-wrap items-center gap-3">
              <span
                className={`chip ${
                  chain.ok
                    ? "border-severity-low/40 bg-severity-low/15 text-severity-low"
                    : "border-severity-critical/40 bg-severity-critical/15 text-severity-critical"
                }`}
              >
                {chain.ok ? "Chain intact" : "Chain broken"}
              </span>
              <span className="text-text-muted">
                {chain.checked.toLocaleString()} event(s) verified
              </span>
            </div>
            {!chain.ok ? (
              <div className="space-y-2">
                {chain.broken_entries.length > 0 ? (
                  <BrokenList
                    title="Broken entry hashes"
                    rows={chain.broken_entries.map((row) => ({
                      audit_id: row.audit_id,
                      detail: `stored ${row.stored_entry_hash.slice(0, 10)}… vs recomputed ${row.recomputed_entry_hash.slice(0, 10)}…`,
                    }))}
                  />
                ) : null}
                {chain.broken_links.length > 0 ? (
                  <BrokenList
                    title="Broken chain links"
                    rows={chain.broken_links.map((row) => ({
                      audit_id: row.audit_id,
                      detail: `stored prev ${
                        row.stored_previous_hash?.slice(0, 10) ?? "null"
                      }… vs expected ${row.expected_previous_hash?.slice(0, 10) ?? "null"}…`,
                    }))}
                  />
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}
      </Panel>

      <Panel
        title="Storage inventory"
        description="Counts managed files on disk against live document rows so orphans are visible before any destructive action."
      >
        {loading && !inventory ? (
          <LoadingSkeleton rows={3} />
        ) : inventory ? (
          <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
            <InventoryCell
              label="Managed files on disk"
              value={inventory.managed_files_on_disk}
              sublabel={formatBytes(inventory.total_bytes_on_disk)}
            />
            <InventoryCell
              label="Referenced by your org"
              value={inventory.referenced_by_organization}
              sublabel={formatBytes(
                inventory.total_bytes_referenced_by_organization
              )}
            />
            <InventoryCell
              label="Dangling references"
              value={inventory.dangling_references_in_organization}
              tone={
                inventory.dangling_references_in_organization > 0
                  ? "warn"
                  : "ok"
              }
            />
            <InventoryCell
              label="Orphaned files"
              value={inventory.orphaned_files}
              tone={inventory.orphaned_files > 0 ? "warn" : "ok"}
              sublabel="On disk, unreferenced"
            />
          </div>
        ) : null}
      </Panel>

      <Panel
        title="Orphan cleanup"
        description="Dry-run first; destructive cleanup removes only files inside the managed storage root that no live document references."
      >
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              className="btn-secondary"
              onClick={handleDryRun}
              disabled={dryRunning || cleaning}
            >
              {dryRunning ? "Running dry run…" : "Run dry-run report"}
            </button>
            <button
              type="button"
              className="btn-danger"
              onClick={() => setConfirming(true)}
              disabled={
                cleaning ||
                dryRunning ||
                !inventory ||
                inventory.orphaned_files === 0
              }
              title={
                inventory && inventory.orphaned_files === 0
                  ? "No orphans to remove."
                  : undefined
              }
            >
              {cleaning ? "Cleaning…" : "Delete orphans"}
            </button>
          </div>
          {lastCleanup ? (
            <dl className="grid grid-cols-2 gap-2 rounded-md border border-surface-border bg-surface-muted/40 p-3 text-xs sm:grid-cols-4">
              <ReportCell label="Mode" value={lastCleanup.dry_run ? "dry run" : "destructive"} />
              <ReportCell label="Examined" value={lastCleanup.files_examined} />
              <ReportCell label="Found" value={lastCleanup.orphaned_found} />
              <ReportCell
                label={lastCleanup.dry_run ? "Would delete" : "Deleted"}
                value={lastCleanup.dry_run ? lastCleanup.orphaned_found : lastCleanup.orphaned_deleted}
              />
              <ReportCell
                label={lastCleanup.dry_run ? "Would reclaim" : "Reclaimed"}
                value={formatBytes(lastCleanup.bytes_reclaimed)}
              />
              <ReportCell label="Errors" value={lastCleanup.errors} />
              <ReportCell label="Run at" value={formatDateTime(new Date().toISOString())} />
            </dl>
          ) : null}
        </div>
      </Panel>

      {confirming ? (
        <ConfirmDialog
          title="Remove orphaned evidence files?"
          description={
            inventory
              ? `This deletes ${inventory.orphaned_files} file(s) under the managed storage root that no live document row references. File paths that escape the root are ignored. Audit history is not affected.`
              : "This removes orphaned files from the managed storage root."
          }
          confirmLabel="Delete orphans"
          tone="danger"
          busy={cleaning}
          onConfirm={confirmDestructiveCleanup}
          onCancel={() => (cleaning ? undefined : setConfirming(false))}
        />
      ) : null}
    </div>
  );
}


function BrokenList({
  title,
  rows,
}: {
  title: string;
  rows: { audit_id: number; detail: string }[];
}) {
  return (
    <div className="rounded-md border border-severity-critical/30 bg-severity-critical/5">
      <div className="border-b border-surface-border px-3 py-2 text-sm font-semibold text-severity-critical">
        {title}
      </div>
      <ul className="divide-y divide-surface-border">
        {rows.map((row) => (
          <li key={row.audit_id} className="px-3 py-2 text-xs">
            <span className="font-mono text-text">audit #{row.audit_id}</span>
            <span className="ml-2 text-text-muted">{row.detail}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}


function InventoryCell({
  label,
  value,
  sublabel,
  tone,
}: {
  label: string;
  value: string | number;
  sublabel?: string;
  tone?: "warn" | "ok";
}) {
  const toneCls =
    tone === "warn"
      ? "text-severity-high"
      : tone === "ok"
      ? "text-severity-low"
      : "text-text";
  return (
    <div className="panel-muted p-3">
      <div className="field-label">{label}</div>
      <div className={`mt-1 text-lg font-semibold tabular-nums ${toneCls}`}>
        {value}
      </div>
      {sublabel ? (
        <div className="mt-0.5 text-xs text-text-muted">{sublabel}</div>
      ) : null}
    </div>
  );
}


function ReportCell({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <dt className="field-label">{label}</dt>
      <dd className="mt-0.5 text-sm font-medium tabular-nums">{value}</dd>
    </div>
  );
}
