interface StatCardProps {
  label: string;
  value: string | number;
  sublabel?: string;
  tone?: "neutral" | "critical" | "warning" | "ok";
}

const toneCls: Record<NonNullable<StatCardProps["tone"]>, string> = {
  neutral: "text-text",
  critical: "text-severity-critical",
  warning: "text-severity-high",
  ok: "text-severity-low",
};

export function StatCard({ label, value, sublabel, tone = "neutral" }: StatCardProps) {
  return (
    <div className="panel p-4">
      <div className="field-label">{label}</div>
      <div className={`mt-2 text-3xl font-semibold tabular-nums ${toneCls[tone]}`}>
        {value}
      </div>
      {sublabel ? (
        <div className="mt-1 text-xs text-text-muted">{sublabel}</div>
      ) : null}
    </div>
  );
}
