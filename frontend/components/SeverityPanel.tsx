import type { EvaluationIssue } from "@/lib/types";

interface SeverityPanelProps {
  tone: "critical" | "warning";
  title: string;
  emptyLabel: string;
  issues: EvaluationIssue[];
}

const toneCls = {
  critical: {
    wrapper: "border-severity-critical/30 bg-severity-critical/5",
    chip:
      "border-severity-critical/40 bg-severity-critical/15 text-severity-critical",
  },
  warning: {
    wrapper: "border-severity-high/30 bg-severity-high/5",
    chip: "border-severity-high/40 bg-severity-high/15 text-severity-high",
  },
} as const;

export function SeverityPanel({
  tone,
  title,
  emptyLabel,
  issues,
}: SeverityPanelProps) {
  const cls = toneCls[tone];
  return (
    <div className={`rounded-md border ${cls.wrapper}`}>
      <div className="border-b border-surface-border px-3 py-2 text-sm font-semibold">
        {title}
      </div>
      {issues.length === 0 ? (
        <div className="px-3 py-3 text-sm text-text-muted">{emptyLabel}</div>
      ) : (
        <ul className="divide-y divide-surface-border">
          {issues.map((issue, idx) => (
            <li
              key={`${issue.rule_code}-${idx}`}
              className="flex items-start gap-3 px-3 py-2"
            >
              <div className="min-w-0 flex-1">
                <div className="font-mono text-xs text-text">{issue.rule_code}</div>
                <div className="text-sm text-text-muted">{issue.message}</div>
              </div>
              {issue.risk_applied > 0 ? (
                <span className={`chip ${cls.chip}`}>+{issue.risk_applied}</span>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
