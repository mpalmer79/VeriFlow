import Link from "next/link";

import { RiskBadge } from "@/components/RiskBadge";
import { StageBadge } from "@/components/StageBadge";
import { StatusBadge } from "@/components/StatusBadge";
import { formatDate } from "@/lib/format";
import type { RecordRead, WorkflowStage } from "@/lib/types";

interface RecordHeaderProps {
  record: RecordRead;
  currentStage?: WorkflowStage;
}

export function RecordHeader({ record, currentStage }: RecordHeaderProps) {
  return (
    <header className="space-y-4">
      <Link
        href="/records"
        className="inline-flex items-center gap-1 text-sm text-text-muted hover:text-text"
      >
        <span aria-hidden>←</span>
        All records
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-text">
            {record.subject_full_name}
          </h1>
          <p className="mt-1 text-sm text-text-muted">
            {record.external_reference ? (
              <>
                Reference{" "}
                <span className="font-mono text-text">
                  {record.external_reference}
                </span>
              </>
            ) : (
              "No external reference"
            )}
            {" · "}DOB {formatDate(record.subject_dob)}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={record.status} />
          <RiskBadge
            band={record.risk_band}
            score={record.risk_score}
            size="md"
          />
        </div>
      </div>

      <dl className="grid grid-cols-1 gap-x-8 gap-y-3 sm:grid-cols-3">
        <MetaCell label="Current stage">
          {currentStage ? (
            <StageBadge
              name={currentStage.name}
              orderIndex={currentStage.order_index}
              tone="current"
            />
          ) : (
            <span>Stage #{record.current_stage_id}</span>
          )}
        </MetaCell>
        <MetaCell label="Assigned to">
          <span className="text-sm font-medium">
            {record.assigned_user_name ?? "Unassigned"}
          </span>
        </MetaCell>
        <MetaCell label="Record version">
          <span className="font-mono text-sm">v{record.version}</span>
        </MetaCell>
      </dl>
    </header>
  );
}


function MetaCell({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <dt className="field-label">{label}</dt>
      <dd className="mt-1">{children}</dd>
    </div>
  );
}
