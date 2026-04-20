"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import { EmptyState } from "@/components/EmptyState";
import { ErrorBanner } from "@/components/ErrorBanner";
import {
  Activity,
  AlertOctagon,
  AlertTriangle,
  Clock,
} from "@/components/icons";
import { LoadingSkeleton } from "@/components/LoadingSkeleton";
import { Panel } from "@/components/Panel";
import { RiskBadge } from "@/components/RiskBadge";
import { StageBadge } from "@/components/StageBadge";
import { StatusBadge } from "@/components/StatusBadge";
import { KPICard } from "@/components/ui/KPICard";
import { ApiError, records as recordsApi } from "@/lib/api";
import { fadeRise, SPRING_DEFAULT, staggerParent } from "@/lib/motion";
import { formatDateTime } from "@/lib/format";
import {
  loadStagesForRecords,
  stageMapKey,
  type StageMap,
} from "@/lib/workflow-stages";
import type { RecordRead } from "@/lib/types";

function formatClockTime(date: Date | null): string {
  if (!date) return "—";
  return date.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function sortAttention(a: RecordRead, b: RecordRead): number {
  const aBlocked = a.status === "blocked" ? 1 : 0;
  const bBlocked = b.status === "blocked" ? 1 : 0;
  if (aBlocked !== bBlocked) return bBlocked - aBlocked;
  if (b.risk_score !== a.risk_score) return b.risk_score - a.risk_score;
  return (
    new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
  );
}

function sortRecent(a: RecordRead, b: RecordRead): number {
  return (
    new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
  );
}

export default function DashboardPage() {
  const [data, setData] = useState<RecordRead[] | null>(null);
  const [stageMap, setStageMap] = useState<StageMap>(new Map());
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await recordsApi.list({ limit: 200 });
      setData(result);
      setLastRefreshed(new Date());
      // Stage names resolved per-workflow so records from different
      // workflows do not collide on matching stage_ids.
      setStageMap(await loadStagesForRecords(result));
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.detail || err.message
          : err instanceof Error
            ? err.message
            : "Failed to load dashboard data.";
      setError(message);
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const stats = useMemo(() => {
    if (!data) {
      return {
        total: 0,
        inProgress: 0,
        blocked: 0,
        highRisk: 0,
      };
    }
    return {
      total: data.length,
      inProgress: data.filter((r) => r.status === "in_progress").length,
      blocked: data.filter((r) => r.status === "blocked").length,
      highRisk: data.filter(
        (r) => r.risk_band === "high" || r.risk_band === "critical"
      ).length,
    };
  }, [data]);

  const attentionRows = useMemo(() => {
    if (!data) return [];
    return [...data]
      .filter(
        (r) =>
          r.status === "blocked" ||
          r.risk_band === "high" ||
          r.risk_band === "critical"
      )
      .sort(sortAttention)
      .slice(0, 8);
  }, [data]);

  const recentRows = useMemo(() => {
    if (!data) return [];
    return [...data].sort(sortRecent).slice(0, 6);
  }, [data]);

  const showPanels = !loading && !error && data !== null;

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-text">
            Operations overview
          </h1>
          <p className="mt-1 text-sm text-text-muted">
            Live summary of records moving through the active workflow.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-text-muted">
            Last refreshed:{" "}
            <span className="tabular-nums text-text">
              {formatClockTime(lastRefreshed)}
            </span>
          </span>
          <button
            type="button"
            className="btn-secondary"
            onClick={() => void fetchData()}
            disabled={loading}
          >
            {loading ? "Refreshing…" : "Refresh"}
          </button>
        </div>
      </header>

      {error ? <ErrorBanner message={error} /> : null}

      <motion.div
        variants={staggerParent}
        initial="hidden"
        animate="visible"
        className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
      >
        <motion.div variants={fadeRise} transition={SPRING_DEFAULT}>
          <KPICard
            label="Total records"
            value={loading || !data ? "—" : stats.total}
            sublabel={
              data ? `${stats.total === 1 ? "record" : "records"} in view` : "loading…"
            }
            icon={Activity}
            tone="neutral"
          />
        </motion.div>
        <motion.div variants={fadeRise} transition={SPRING_DEFAULT}>
          <KPICard
            label="In progress"
            value={loading || !data ? "—" : stats.inProgress}
            sublabel={
              data
                ? stats.inProgress > 0
                  ? "moving through stages"
                  : "nothing in flight"
                : "loading…"
            }
            icon={Clock}
            tone="neutral"
          />
        </motion.div>
        <motion.div variants={fadeRise} transition={SPRING_DEFAULT}>
          <KPICard
            label="Blocked"
            value={loading || !data ? "—" : stats.blocked}
            sublabel={
              data
                ? stats.blocked > 0
                  ? "resolution required"
                  : "no active blocks"
                : "loading…"
            }
            icon={AlertOctagon}
            tone="critical"
            highlighted={!!data && stats.blocked > 0}
          />
        </motion.div>
        <motion.div variants={fadeRise} transition={SPRING_DEFAULT}>
          <KPICard
            label="High or critical risk"
            value={loading || !data ? "—" : stats.highRisk}
            sublabel={
              data
                ? stats.highRisk > 0
                  ? "review recommended"
                  : "risk contained"
                : "loading…"
            }
            icon={AlertTriangle}
            tone="warning"
          />
        </motion.div>
      </motion.div>

      {loading && !error ? (
        <div className="grid gap-6 lg:grid-cols-3">
          <Panel
            title="Needs attention"
            description="Blocked and high-risk records, highest risk first."
            className="lg:col-span-2"
          >
            <LoadingSkeleton rows={6} />
          </Panel>
          <Panel title="Recently updated" className="lg:col-span-1">
            <LoadingSkeleton rows={6} />
          </Panel>
        </div>
      ) : null}

      {showPanels ? (
        <div className="grid gap-6 lg:grid-cols-3">
          <Panel
            title="Needs attention"
            description="Blocked and high-risk records, highest risk first."
            className="lg:col-span-2"
            actions={
              <Link
                href="/records"
                className="text-xs font-medium text-accent hover:underline"
              >
                View all records
              </Link>
            }
          >
            {attentionRows.length === 0 ? (
              <EmptyState
                title="Nothing needs attention"
                description="No records are blocked and no records are in the high or critical risk bands."
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs uppercase tracking-wide text-text-subtle">
                      <th className="py-2 pr-4 font-medium">Subject</th>
                      <th className="py-2 pr-4 font-medium">Stage</th>
                      <th className="py-2 pr-4 font-medium">Status</th>
                      <th className="py-2 pr-4 font-medium">Risk</th>
                      <th className="py-2 pr-4 font-medium">Assigned to</th>
                      <th className="py-2 font-medium">Updated</th>
                    </tr>
                  </thead>
                  <tbody>
                    {attentionRows.map((r) => {
                      const stage = stageMap.get(
                        stageMapKey(r.workflow_id, r.current_stage_id),
                      );
                      return (
                        <tr
                          key={r.id}
                          className="border-t border-surface-border align-middle"
                        >
                          <td className="py-2 pr-4">
                            <Link
                              href={`/records/${r.id}`}
                              className="font-medium text-text hover:text-accent hover:underline"
                            >
                              {r.subject_full_name}
                            </Link>
                            {r.external_reference ? (
                              <div className="text-xs text-text-subtle">
                                {r.external_reference}
                              </div>
                            ) : null}
                          </td>
                          <td className="py-2 pr-4">
                            {stage ? (
                              <StageBadge
                                name={stage.name}
                                orderIndex={stage.order_index}
                                tone="neutral"
                              />
                            ) : (
                              <span className="text-text-muted">
                                Stage #{r.current_stage_id}
                              </span>
                            )}
                          </td>
                          <td className="py-2 pr-4">
                            <StatusBadge status={r.status} />
                          </td>
                          <td className="py-2 pr-4">
                            <RiskBadge band={r.risk_band} score={r.risk_score} />
                          </td>
                          <td className="py-2 pr-4 text-xs text-text-muted">
                            {r.assigned_user_name ?? "Unassigned"}
                          </td>
                          <td className="py-2 text-xs text-text-muted">
                            {formatDateTime(r.updated_at)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>

          <Panel
            title="Recently updated"
            description="Latest activity across all records."
            className="lg:col-span-1"
          >
            {recentRows.length === 0 ? (
              <EmptyState title="No records yet" />
            ) : (
              <ul className="divide-y divide-surface-border">
                {recentRows.map((r) => (
                  <li
                    key={r.id}
                    className="flex items-center justify-between gap-3 py-2 first:pt-0 last:pb-0"
                  >
                    <div className="min-w-0 flex-1">
                      <Link
                        href={`/records/${r.id}`}
                        className="block truncate text-sm font-medium text-text hover:text-accent hover:underline"
                      >
                        {r.subject_full_name}
                      </Link>
                      <div className="mt-0.5 text-xs text-text-muted">
                        {formatDateTime(r.updated_at)}
                      </div>
                    </div>
                    <StatusBadge status={r.status} />
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      ) : null}
    </div>
  );
}
