"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useState } from "react";

import { EmptyState } from "@/components/EmptyState";
import {
  Activity,
  ArrowRight,
  ChevronRight,
  FileCheck2,
  FileX2,
  Link2,
  type LucideIcon,
} from "@/components/icons";
import { Panel } from "@/components/Panel";
import { MotionList } from "@/components/ui/MotionList";
import { RuleCodeBadge } from "@/components/ui/RuleCodeBadge";
import { fadeRise, SPRING_DEFAULT } from "@/lib/motion";
import { formatDateTime } from "@/lib/format";
import { formatRelativeTime } from "@/lib/relative-time";
import type { AuditEntry, WorkflowStage } from "@/lib/types";

const SEMANTIC_KEYS = [
  "prior_stage_id",
  "new_stage_id",
  "current_stage_id",
  "target_stage_id",
  "stage_context_id",
  "rules_evaluated",
  "blocking_rule_codes",
  "warning_rule_codes",
  "prior_risk_score",
  "new_risk_score",
  "risk_score",
  "risk_band",
  "document_type",
  "document_status",
  "verified_by",
  "rejected_by",
  "rejection_reason",
] as const;

const STAGE_KEYS = new Set([
  "prior_stage_id",
  "new_stage_id",
  "current_stage_id",
  "target_stage_id",
  "stage_context_id",
]);

const RULE_CODE_LIST_KEYS = new Set([
  "blocking_rule_codes",
  "warning_rule_codes",
  "rules_evaluated",
]);

const KEY_LABEL: Record<string, string> = {
  prior_stage_id: "From stage",
  new_stage_id: "To stage",
  current_stage_id: "Current stage",
  target_stage_id: "Target stage",
  stage_context_id: "Stage context",
  rules_evaluated: "Rules evaluated",
  blocking_rule_codes: "Blocking",
  warning_rule_codes: "Warnings",
  prior_risk_score: "Risk (before)",
  new_risk_score: "Risk (after)",
  risk_score: "Risk score",
  risk_band: "Risk band",
  document_type: "Document type",
  document_status: "Status",
  verified_by: "Verified by",
  rejected_by: "Rejected by",
  rejection_reason: "Reason",
};

function iconForAction(action: string): LucideIcon {
  if (action.startsWith("record.transition")) return ArrowRight;
  if (action.startsWith("record.evaluated") || action.startsWith("record.risk"))
    return Activity;
  if (action === "document.verified") return FileCheck2;
  if (action === "document.rejected") return FileX2;
  if (action.startsWith("document.")) return FileCheck2;
  if (action.startsWith("storage.")) return Link2;
  return Activity;
}

function humanAction(action: string): string {
  return action
    .replace(/\./g, " · ")
    .replace(/_/g, " ");
}

interface AuditTrailProps {
  entries: AuditEntry[];
  stagesById?: Map<number, WorkflowStage>;
}

export function AuditTrail({ entries, stagesById }: AuditTrailProps) {
  return (
    <Panel
      title="Audit trail"
      description="Append-only. Most recent events first."
    >
      {entries.length === 0 ? (
        <EmptyState
          title="No audit history yet"
          description="Audit events will appear here after the first evaluation, transition, or document change."
        />
      ) : (
        <MotionList as="ol" tight>
          {entries.map((entry) => (
            <motion.li
              key={entry.id}
              variants={fadeRise}
              transition={SPRING_DEFAULT}
              className="mb-2 last:mb-0"
            >
              <AuditRow entry={entry} stagesById={stagesById} />
            </motion.li>
          ))}
        </MotionList>
      )}
    </Panel>
  );
}

function AuditRow({
  entry,
  stagesById,
}: {
  entry: AuditEntry;
  stagesById?: Map<number, WorkflowStage>;
}) {
  const reduce = useReducedMotion();
  const [rawOpen, setRawOpen] = useState(false);
  const Icon = iconForAction(entry.action);
  const payload = (entry.payload ?? {}) as Record<string, unknown>;

  const semantic = SEMANTIC_KEYS.filter((key) => {
    const raw = payload[key];
    return raw !== undefined && raw !== null && !(Array.isArray(raw) && raw.length === 0);
  });
  const rawEntries = Object.entries(payload).filter(
    ([k]) => !(SEMANTIC_KEYS as readonly string[]).includes(k),
  );

  return (
    <div className="panel-muted p-3">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-surface-border text-text-muted">
          <Icon size={13} aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-sm font-medium text-text">
              {humanAction(entry.action)}
            </span>
            <span
              className="text-xs text-text-muted"
              title={formatDateTime(entry.created_at)}
            >
              {formatRelativeTime(entry.created_at)}
              <span className="ml-2 text-text-subtle">
                {formatDateTime(entry.created_at)}
              </span>
            </span>
          </div>

          {semantic.length > 0 ? (
            <dl className="mt-2 grid grid-cols-1 gap-x-4 gap-y-1 text-xs sm:grid-cols-2">
              {semantic.map((key) => (
                <div key={key} className="flex flex-wrap items-baseline gap-2">
                  <dt className="text-text-subtle">{KEY_LABEL[key] ?? key}:</dt>
                  <dd className="min-w-0 text-text">
                    <PayloadValue
                      keyName={key}
                      value={payload[key]}
                      stagesById={stagesById}
                    />
                  </dd>
                </div>
              ))}
            </dl>
          ) : null}

          {rawEntries.length > 0 ? (
            <div className="mt-2">
              <button
                type="button"
                onClick={() => setRawOpen((v) => !v)}
                className="inline-flex items-center gap-1 text-xs text-text-subtle transition-colors hover:text-text focus:outline-none"
                aria-expanded={rawOpen}
              >
                <motion.span
                  animate={reduce ? undefined : { rotate: rawOpen ? 90 : 0 }}
                  transition={reduce ? { duration: 0 } : { duration: 0.18 }}
                  className="inline-flex"
                >
                  <ChevronRight size={12} aria-hidden />
                </motion.span>
                {rawOpen ? "Hide raw payload" : "Show raw payload"}
              </button>
              <AnimatePresence initial={false}>
                {rawOpen ? (
                  <motion.div
                    key="raw"
                    layout
                    initial={reduce ? false : { opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={reduce ? undefined : { opacity: 0, height: 0 }}
                    transition={
                      reduce ? { duration: 0 } : { duration: 0.22, ease: "easeOut" }
                    }
                    className="overflow-hidden"
                  >
                    <dl className="mt-2 grid grid-cols-1 gap-x-4 gap-y-1 text-[11px] sm:grid-cols-2">
                      {rawEntries.map(([k, v]) => (
                        <div key={k} className="flex gap-2">
                          <dt className="font-mono text-text-subtle">{k}:</dt>
                          <dd className="break-all text-text">
                            {Array.isArray(v)
                              ? v.map(String).join(", ") || "—"
                              : typeof v === "object" && v !== null
                                ? JSON.stringify(v)
                                : String(v)}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  </motion.div>
                ) : null}
              </AnimatePresence>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function PayloadValue({
  keyName,
  value,
  stagesById,
}: {
  keyName: string;
  value: unknown;
  stagesById?: Map<number, WorkflowStage>;
}) {
  if (STAGE_KEYS.has(keyName) && typeof value === "number") {
    const stage = stagesById?.get(value);
    return (
      <span className="inline-flex flex-wrap items-baseline gap-1.5">
        <span>{stage ? stage.name : `Stage #${value}`}</span>
        {stage ? <span className="mono text-text-subtle">#{value}</span> : null}
      </span>
    );
  }
  if (RULE_CODE_LIST_KEYS.has(keyName) && Array.isArray(value)) {
    if (value.length === 0) return <span className="text-text-subtle">—</span>;
    return (
      <span className="inline-flex flex-wrap items-center gap-1">
        {value.map((code) => (
          <RuleCodeBadge key={String(code)} code={String(code)} />
        ))}
      </span>
    );
  }
  if (Array.isArray(value)) {
    return <span>{value.map(String).join(", ") || "—"}</span>;
  }
  if (typeof value === "object" && value !== null) {
    return <span className="break-all">{JSON.stringify(value)}</span>;
  }
  return <span>{String(value)}</span>;
}
