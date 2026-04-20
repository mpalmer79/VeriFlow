"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useCallback, useEffect, useState } from "react";

import { ConfirmDialog } from "@/components/ConfirmDialog";
import { EmptyState } from "@/components/EmptyState";
import { ErrorBanner } from "@/components/ErrorBanner";
import { Link2 } from "@/components/icons";
import { LoadingSkeleton } from "@/components/LoadingSkeleton";
import { Panel } from "@/components/Panel";
import { MotionList } from "@/components/ui/MotionList";
import { useToast } from "@/components/ui/Toast";
import { ApiError, audit } from "@/lib/api";
import { readUser } from "@/lib/auth";
import { formatBytes, formatDateTime } from "@/lib/format";
import {
  DURATION_SHORT,
  EASE_OUT,
  fadeRise,
  SPRING_DEFAULT,
} from "@/lib/motion";
import { formatRelativeTime } from "@/lib/relative-time";
import type {
  AuditChainReport,
  StorageCleanupReport,
  StorageInventoryReport,
} from "@/lib/types";


interface CleanupRun {
  report: StorageCleanupReport;
  completedAt: string;
}


export default function OperationsPage() {
  const toast = useToast();
  const reduce = useReducedMotion();
  const [authorized, setAuthorized] = useState<boolean | null>(null);

  const [chain, setChain] = useState<AuditChainReport | null>(null);
  const [inventory, setInventory] = useState<StorageInventoryReport | null>(null);
  const [lastRun, setLastRun] = useState<CleanupRun | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [cleaning, setCleaning] = useState(false);
  const [dryRunning, setDryRunning] = useState(false);
  const [confirming, setConfirming] = useState(false);

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
          err instanceof ApiError ? err.detail ?? err.message : "Failed to load operations data.",
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
    try {
      const report = await audit.storageCleanup(true);
      setLastRun({ report, completedAt: new Date().toISOString() });
      toast.push({
        kind: "info",
        text: `Dry run complete: ${report.orphaned_found} orphan(s) would be removed.`,
      });
    } catch (err) {
      toast.push({
        kind: "error",
        text: err instanceof ApiError ? err.detail ?? err.message : "Dry run failed.",
      });
    } finally {
      setDryRunning(false);
    }
  }

  async function confirmDestructiveCleanup() {
    setCleaning(true);
    try {
      const report = await audit.storageCleanup(false);
      setLastRun({ report, completedAt: new Date().toISOString() });
      setConfirming(false);
      await refresh();
      toast.push({
        kind: "success",
        text: `Cleanup complete: removed ${report.orphaned_deleted} orphan(s), reclaimed ${formatBytes(
          report.bytes_reclaimed,
        )}.`,
      });
    } catch (err) {
      toast.push({
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

  const chainBroken = Boolean(chain && !chain.ok);
  const chainBorderTransition = reduce
    ? { duration: 0 }
    : { duration: DURATION_SHORT, ease: EASE_OUT };

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-text">
            Operations
          </h1>
          <p className="mt-1 text-sm text-text-muted">
            Audit-chain verification and managed-storage inventory are
            read-only. Orphan cleanup is destructive and runs only against
            files inside the managed storage root.
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

      <SectionHeader
        label="Read-only checks"
        description="Safe to run at any time. No writes occur."
      />

      <motion.div
        className="rounded-lg"
        initial={false}
        animate={{
          boxShadow: chainBroken
            ? "0 0 0 1px rgba(239, 68, 68, 0.6)"
            : "0 0 0 0px rgba(239, 68, 68, 0)",
        }}
        transition={chainBorderTransition}
      >
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
                  className={`chip gap-1.5 ${
                    chain.ok
                      ? "border-verified/40 bg-verified/15 text-verified"
                      : "border-severity-critical/40 bg-severity-critical/15 text-severity-critical"
                  }`}
                >
                  <Link2 size={12} aria-hidden />
                  {chain.ok ? "Chain intact" : "Chain broken"}
                </span>
                <span className="text-text-muted">
                  <span className="mono text-text">
                    {chain.checked.toLocaleString()}
                  </span>{" "}
                  event{chain.checked === 1 ? "" : "s"} verified
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
      </motion.div>

      <Panel
        title="Storage inventory"
        description="Counts managed files on disk against live document rows so orphans are visible before any destructive action."
      >
        {loading && !inventory ? (
          <LoadingSkeleton rows={3} />
        ) : inventory ? (
          <MotionList
            as="div"
            className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3"
          >
            <motion.div variants={fadeRise} transition={SPRING_DEFAULT}>
              <InventoryCell
                label="Managed files on disk"
                value={inventory.managed_files_on_disk}
                sublabel={formatBytes(inventory.total_bytes_on_disk)}
              />
            </motion.div>
            <motion.div variants={fadeRise} transition={SPRING_DEFAULT}>
              <InventoryCell
                label="Referenced by your org"
                value={inventory.referenced_by_organization}
                sublabel={formatBytes(
                  inventory.total_bytes_referenced_by_organization,
                )}
              />
            </motion.div>
            <motion.div variants={fadeRise} transition={SPRING_DEFAULT}>
              <InventoryCell
                label="Dangling references"
                value={inventory.dangling_references_in_organization}
                tone={
                  inventory.dangling_references_in_organization > 0
                    ? "warn"
                    : "ok"
                }
              />
            </motion.div>
            <motion.div variants={fadeRise} transition={SPRING_DEFAULT}>
              <InventoryCell
                label="Orphaned files"
                value={inventory.orphaned_files}
                tone={inventory.orphaned_files > 0 ? "warn" : "ok"}
                sublabel="On disk, unreferenced"
              />
            </motion.div>
          </MotionList>
        ) : null}
      </Panel>

      <SectionHeader
        label="Destructive operations"
        description="Require an explicit confirmation step. Run a dry-run first."
        tone="warn"
      />

      <Panel
        title="Orphan cleanup"
        description="Sweeps files inside the managed storage root that no live document row references. A dry-run is always free; the destructive run is bounded and auditable."
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
            {lastRun ? (
              <div className="ml-auto text-xs text-text-muted">
                Last cleanup{" "}
                <span
                  className="text-text"
                  title={formatDateTime(lastRun.completedAt)}
                >
                  {formatRelativeTime(lastRun.completedAt)}
                </span>
                <span className="ml-2 text-text-subtle">
                  {formatDateTime(lastRun.completedAt)}
                </span>
              </div>
            ) : null}
          </div>
          {lastRun ? (
            <dl className="grid grid-cols-2 gap-2 rounded-md border border-surface-border bg-surface-muted/40 p-3 text-xs sm:grid-cols-4">
              <ReportCell
                label="Mode"
                value={lastRun.report.dry_run ? "dry run" : "destructive"}
              />
              <ReportCell label="Examined" value={lastRun.report.files_examined} />
              <ReportCell label="Found" value={lastRun.report.orphaned_found} />
              <ReportCell
                label={lastRun.report.dry_run ? "Would delete" : "Deleted"}
                value={
                  lastRun.report.dry_run
                    ? lastRun.report.orphaned_found
                    : lastRun.report.orphaned_deleted
                }
              />
              <ReportCell
                label={lastRun.report.dry_run ? "Would reclaim" : "Reclaimed"}
                value={formatBytes(lastRun.report.bytes_reclaimed)}
              />
              <ReportCell label="Errors" value={lastRun.report.errors} />
              <ReportCell
                label="Run at"
                value={formatDateTime(lastRun.completedAt)}
              />
            </dl>
          ) : (
            <p className="text-xs text-text-subtle">
              No cleanup has run yet. Start with a dry-run to review what
              would be removed.
            </p>
          )}
        </div>
      </Panel>

      <ConfirmDialog
        open={confirming}
        title="Delete orphaned evidence files?"
        description={
          inventory
            ? `This permanently deletes ${inventory.orphaned_files} file(s) from the managed storage root that no live document row references. Paths outside the root are ignored. Audit history is not affected, and a storage.cleanup audit event is recorded.`
            : "This permanently removes orphaned files from the managed storage root."
        }
        confirmLabel={
          inventory && inventory.orphaned_files > 0
            ? `Delete ${inventory.orphaned_files} file(s)`
            : "Delete orphans"
        }
        tone="danger"
        busy={cleaning}
        onConfirm={confirmDestructiveCleanup}
        onCancel={() => (cleaning ? undefined : setConfirming(false))}
      />
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
        ? "text-verified"
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


function SectionHeader({
  label,
  description,
  tone,
}: {
  label: string;
  description: string;
  tone?: "warn";
}) {
  const accentCls =
    tone === "warn" ? "text-severity-high" : "text-text-muted";
  return (
    <div className="flex items-baseline gap-3 border-b border-surface-border pb-2">
      <h2
        className={`field-label ${
          tone === "warn" ? "text-severity-high" : "text-text"
        }`}
      >
        {label}
      </h2>
      <p className={`text-xs ${accentCls}`}>{description}</p>
    </div>
  );
}
