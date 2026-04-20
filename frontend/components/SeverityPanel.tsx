"use client";

import { animate, motion, useReducedMotion } from "framer-motion";
import { useEffect, useRef } from "react";

import { AlertOctagon, AlertTriangle, CircleCheck } from "@/components/icons";
import { RuleCodeBadge } from "@/components/ui/RuleCodeBadge";
import {
  DURATION_SHORT,
  EASE_OUT,
  fadeRise,
  overlayFade,
  staggerParent,
} from "@/lib/motion";
import type { EvaluationIssue } from "@/lib/types";

type Tone = "critical" | "warning";

interface SeverityPanelProps {
  tone: Tone;
  title: string;
  emptyLabel: string;
  issues: EvaluationIssue[];
}

const toneCls: Record<Tone, { wrapper: string; icon: string; chip: string }> = {
  critical: {
    wrapper: "border-severity-critical/30 bg-severity-critical/5",
    icon: "text-severity-critical",
    chip: "bg-severity-critical/25 text-severity-critical",
  },
  warning: {
    wrapper: "border-severity-high/30 bg-severity-high/5",
    icon: "text-severity-high",
    chip: "bg-severity-high/25 text-severity-high",
  },
};

export function SeverityPanel({
  tone,
  title,
  emptyLabel,
  issues,
}: SeverityPanelProps) {
  const cls = toneCls[tone];
  const Icon = tone === "critical" ? AlertOctagon : AlertTriangle;
  return (
    <div className={`rounded-md border ${cls.wrapper}`}>
      <div className="flex items-center gap-2 border-b border-surface-border px-3 py-2 text-sm font-semibold">
        <Icon size={14} className={cls.icon} aria-hidden />
        {title}
        {issues.length > 0 ? (
          <span className="ml-auto text-xs font-normal text-text-muted">
            {issues.length}
          </span>
        ) : null}
      </div>
      {issues.length === 0 ? (
        <motion.div
          variants={overlayFade}
          initial="hidden"
          animate="visible"
          transition={{ duration: DURATION_SHORT, ease: EASE_OUT }}
          className="flex items-center justify-center gap-2 px-3 py-8 text-sm text-text-muted"
        >
          <CircleCheck size={18} className="text-verified" aria-hidden />
          {emptyLabel}
        </motion.div>
      ) : (
        <motion.ul
          variants={staggerParent}
          initial="hidden"
          animate="visible"
          className="divide-y divide-surface-border"
        >
          {issues.map((issue, idx) => (
            <motion.li
              key={`${issue.rule_code}-${idx}`}
              variants={fadeRise}
              className="flex items-start gap-3 px-3 py-2.5"
            >
              <Icon
                size={16}
                className={`mt-0.5 shrink-0 ${cls.icon}`}
                aria-hidden
              />
              <div className="min-w-0 flex-1 space-y-1">
                <RuleCodeBadge code={issue.rule_code} />
                <div className="text-sm text-text-muted">{issue.message}</div>
              </div>
              {issue.risk_applied > 0 ? (
                <RiskChip value={issue.risk_applied} toneClass={cls.chip} />
              ) : null}
            </motion.li>
          ))}
        </motion.ul>
      )}
    </div>
  );
}

function RiskChip({ value, toneClass }: { value: number; toneClass: string }) {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLSpanElement>(null);
  const prev = useRef(value);

  useEffect(() => {
    if (prev.current !== value) {
      if (!reduce && ref.current) {
        animate(
          ref.current,
          { scale: [1, 1.08, 1] },
          { duration: DURATION_SHORT },
        );
      }
      prev.current = value;
    }
  }, [value, reduce]);

  return (
    <span
      ref={ref}
      className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 ${toneClass}`}
      aria-label={`Risk weight ${value}`}
    >
      <span className="font-display text-sm font-semibold leading-none">+{value}</span>
    </span>
  );
}
