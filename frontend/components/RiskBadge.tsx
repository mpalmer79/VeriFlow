import type { RiskBand } from "@/lib/types";
import { RISK_BAND_LABELS } from "@/lib/format";

interface RiskBadgeProps {
  band: RiskBand;
  score?: number;
  size?: "sm" | "md";
}

const styles: Record<RiskBand, string> = {
  low: "border-severity-low/40 bg-severity-low/15 text-severity-low",
  moderate:
    "border-severity-moderate/40 bg-severity-moderate/15 text-severity-moderate",
  high: "border-severity-high/40 bg-severity-high/15 text-severity-high",
  critical:
    "border-severity-critical/40 bg-severity-critical/15 text-severity-critical",
};

export function RiskBadge({ band, score, size = "sm" }: RiskBadgeProps) {
  const label = RISK_BAND_LABELS[band];
  const sizeCls = size === "md" ? "px-2.5 py-1 text-sm" : "px-2 py-0.5 text-xs";
  return (
    <span className={`chip ${styles[band]} ${sizeCls}`}>
      <span className="font-semibold">{label}</span>
      {score !== undefined ? (
        <span className="ml-1.5 opacity-80">({score})</span>
      ) : null}
    </span>
  );
}
