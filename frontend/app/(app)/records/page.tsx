"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import { EmptyState } from "@/components/EmptyState";
import { ErrorBanner } from "@/components/ErrorBanner";
import { LoadingSkeleton } from "@/components/LoadingSkeleton";
import { Panel } from "@/components/Panel";
import { RiskBadge } from "@/components/RiskBadge";
import { StatusBadge } from "@/components/StatusBadge";
import { ApiError, records as recordsApi, workflows as workflowsApi } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import type {
  RecordRead,
  RecordStatus,
  RiskBand,
  WorkflowStage,
} from "@/lib/types";

type StageMap = Map<number, WorkflowStage>;

const RISK_BAND_OPTIONS: { value: RiskBand; label: string }[] = [
  { value: "low", label: "Low" },
  { value: "moderate", label: "Moderate" },
  { value: "high", label: "High" },
  { value: "critical", label: "Critical" },
];

const STATUS_OPTIONS: { value: RecordStatus; label: string }[] = [
  { value: "draft", label: "Draft" },
  { value: "in_progress", label: "In Progress" },
  { value: "blocked", label: "Blocked" },
  { value: "ready", label: "Ready" },
  { value: "closed", label: "Closed" },
];

export default function RecordsPage() {
  const router = useRouter();

  const [rows, setRows] = useState<RecordRead[]>([]);
  const [stageMap, setStageMap] = useState<StageMap>(new Map());
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [search, setSearch] = useState<string>("");
  const [stageId, setStageId] = useState<string>("all");
  const [riskBand, setRiskBand] = useState<string>("all");
  const [status, setStatus] = useState<string>("all");

  const load = useCallback(async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const list = await recordsApi.list({ limit: 500 });
      setRows(list);
      if (list.length > 0) {
        try {
          const workflow = await workflowsApi.get(list[0].workflow_id);
          const nextMap: StageMap = new Map();
          for (const stage of workflow.stages) {
            nextMap.set(stage.id, stage);
          }
          setStageMap(nextMap);
        } catch {
          setStageMap(new Map());
        }
      } else {
        setStageMap(new Map());
      }
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.detail ?? err.message
          : err instanceof Error
            ? err.message
            : "Failed to load records.";
      setErrorMessage(message);
      setRows([]);
      setStageMap(new Map());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const stageOptions = useMemo(() => {
    return Array.from(stageMap.values()).sort(
      (a, b) => a.order_index - b.order_index,
    );
  }, [stageMap]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return rows.filter((record) => {
      if (term) {
        const subject = record.subject_full_name?.toLowerCase() ?? "";
        const ref = record.external_reference?.toLowerCase() ?? "";
        if (!subject.includes(term) && !ref.includes(term)) {
          return false;
        }
      }
      if (stageId !== "all" && record.current_stage_id !== Number(stageId)) {
        return false;
      }
      if (riskBand !== "all" && record.risk_band !== riskBand) {
        return false;
      }
      if (status !== "all" && record.status !== status) {
        return false;
      }
      return true;
    });
  }, [rows, search, stageId, riskBand, status]);

  const stageNameFor = (id: number): string => {
    const stage = stageMap.get(id);
    return stage ? stage.name : `Stage #${id}`;
  };

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-xl font-semibold text-text">Records</h1>
        <p className="mt-1 text-sm text-text-muted">
          All records across the active workflow.
        </p>
      </header>

      <div className="flex flex-wrap items-center gap-3">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by subject or reference"
          className="input max-w-xs"
        />
        <select
          value={stageId}
          onChange={(e) => setStageId(e.target.value)}
          className="input w-auto"
        >
          <option value="all">All stages</option>
          {stageOptions.map((stage) => (
            <option key={stage.id} value={String(stage.id)}>
              {stage.name}
            </option>
          ))}
        </select>
        <select
          value={riskBand}
          onChange={(e) => setRiskBand(e.target.value)}
          className="input w-auto"
        >
          <option value="all">All risk bands</option>
          {RISK_BAND_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="input w-auto"
        >
          <option value="all">All statuses</option>
          {STATUS_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <button
          type="button"
          className="btn-secondary ml-auto"
          onClick={() => void load()}
          disabled={loading}
        >
          Refresh
        </button>
      </div>

      {errorMessage ? <ErrorBanner message={errorMessage} /> : null}

      <Panel>
        <div className="-mx-4 -my-4">
          {loading ? (
            <div className="px-4 py-4">
              <LoadingSkeleton rows={8} />
            </div>
          ) : rows.length === 0 ? (
            <div className="px-4 py-4">
              <EmptyState
                title="No records yet"
                description="Seed the backend to populate demo records."
              />
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-surface-muted/50 text-xs font-medium uppercase tracking-wide text-text-subtle">
                  <th className="px-4 py-2 text-left">Subject</th>
                  <th className="px-4 py-2 text-left">Stage</th>
                  <th className="px-4 py-2 text-left">Status</th>
                  <th className="px-4 py-2 text-left">Risk</th>
                  <th className="px-4 py-2 text-left">Assigned</th>
                  <th className="px-4 py-2 text-left">Updated</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-6">
                      <div className="text-center text-xs text-text-muted">
                        No records match the current filters.
                      </div>
                    </td>
                  </tr>
                ) : (
                  filtered.map((record) => {
                    const blocked = record.status === "blocked";
                    return (
                      <tr
                        key={record.id}
                        onClick={() => router.push(`/records/${record.id}`)}
                        className={`cursor-pointer border-t border-surface-border transition-colors hover:bg-surface-muted/50 ${
                          blocked ? "border-l-2 border-l-severity-critical" : ""
                        }`}
                      >
                        <td className="px-4 py-3 align-top">
                          <Link
                            href={`/records/${record.id}`}
                            onClick={(e) => e.stopPropagation()}
                            className="font-medium text-text hover:text-accent"
                          >
                            {record.subject_full_name}
                          </Link>
                          {record.external_reference ? (
                            <div className="mt-0.5 text-xs text-text-muted">
                              {record.external_reference}
                            </div>
                          ) : null}
                        </td>
                        <td className="px-4 py-3 align-top text-text">
                          {stageNameFor(record.current_stage_id)}
                        </td>
                        <td className="px-4 py-3 align-top">
                          <StatusBadge status={record.status} />
                        </td>
                        <td className="px-4 py-3 align-top tabular-nums">
                          <RiskBadge
                            band={record.risk_band}
                            score={record.risk_score}
                          />
                        </td>
                        <td className="px-4 py-3 align-top text-text-muted">
                          {record.assigned_user_name ?? "Unassigned"}
                        </td>
                        <td className="px-4 py-3 align-top tabular-nums text-text-muted">
                          {formatDateTime(record.updated_at)}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          )}
        </div>
      </Panel>
    </div>
  );
}
