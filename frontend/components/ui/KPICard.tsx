"use client";

import type { LucideIcon } from "@/components/icons";
import { AnimatedNumber } from "@/components/ui/AnimatedNumber";

export type KPITone = "neutral" | "critical" | "warning" | "ok";

interface KPICardProps {
  label: string;
  value: string | number;
  sublabel?: string;
  tone?: KPITone;
  icon?: LucideIcon;
  highlighted?: boolean;
}

const toneText: Record<KPITone, string> = {
  neutral: "text-text",
  critical: "text-severity-critical",
  warning: "text-severity-high",
  ok: "text-verified",
};

const toneIcon: Record<KPITone, string> = {
  neutral: "text-text-muted/70",
  critical: "text-severity-critical/70",
  warning: "text-severity-high/70",
  ok: "text-verified/70",
};

const highlightBorder: Record<KPITone, string> = {
  neutral: "border-brand-600/50",
  critical: "border-severity-critical/60",
  warning: "border-severity-high/60",
  ok: "border-verified/60",
};

export function KPICard({
  label,
  value,
  sublabel,
  tone = "neutral",
  icon: Icon,
  highlighted = false,
}: KPICardProps) {
  return (
    <div
      className={`panel relative flex flex-col justify-between p-5 sm:p-6 ${
        highlighted ? highlightBorder[tone] : ""
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="field-label">{label}</div>
        {Icon ? <Icon size={22} className={toneIcon[tone]} aria-hidden /> : null}
      </div>
      <div
        className={`mt-4 font-display text-5xl font-semibold leading-none tracking-tight tabular-nums ${toneText[tone]}`}
      >
        <AnimatedNumber value={value} />
      </div>
      {sublabel ? (
        <div className="mt-2 text-xs text-text-muted">{sublabel}</div>
      ) : null}
    </div>
  );
}
