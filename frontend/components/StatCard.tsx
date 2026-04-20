"use client";

import { animate, motion, useMotionValue, useReducedMotion, useTransform } from "framer-motion";
import { useEffect } from "react";

import type { LucideIcon } from "@/components/icons";
import { ArrowRight } from "@/components/icons";
import { DURATION_LONG, EASE_OUT_EXPO, DURATION_MEDIUM } from "@/lib/motion";

export type StatCardTone = "neutral" | "critical" | "warning" | "ok";

interface TrendProps {
  direction: "up" | "down" | "flat";
  delta: string;
  sublabel?: string;
}

interface StatCardProps {
  label: string;
  value: string | number;
  sublabel?: string;
  tone?: StatCardTone;
  icon?: LucideIcon;
  trend?: TrendProps;
  spark?: number[];
}

const toneText: Record<StatCardTone, string> = {
  neutral: "text-text",
  critical: "text-severity-critical",
  warning: "text-severity-high",
  ok: "text-verified",
};

const toneStroke: Record<StatCardTone, string> = {
  neutral: "stroke-text-muted",
  critical: "stroke-severity-critical",
  warning: "stroke-severity-high",
  ok: "stroke-verified",
};

const toneIcon: Record<StatCardTone, string> = {
  neutral: "text-text-muted/60",
  critical: "text-severity-critical/60",
  warning: "text-severity-high/60",
  ok: "text-verified/60",
};

const trendGlyph: Record<TrendProps["direction"], string> = {
  up: "rotate-[-45deg]",
  down: "rotate-[45deg]",
  flat: "",
};

export function StatCard({
  label,
  value,
  sublabel,
  tone = "neutral",
  icon: Icon,
  trend,
  spark,
}: StatCardProps) {
  return (
    <div className="panel relative p-4">
      {Icon ? (
        <Icon
          size={20}
          className={`absolute right-4 top-4 ${toneIcon[tone]}`}
          aria-hidden
        />
      ) : null}
      <div className="field-label">{label}</div>
      <div className={`mt-2 text-3xl font-semibold tabular-nums ${toneText[tone]}`}>
        <AnimatedValue value={value} />
      </div>
      {trend ? (
        <div className="mt-1 flex items-center gap-1.5 text-xs text-text-muted">
          <ArrowRight
            size={12}
            className={`${trendGlyph[trend.direction]} ${toneText[tone]} opacity-80`}
            aria-hidden
          />
          <span className={toneText[tone]}>{trend.delta}</span>
          {trend.sublabel ? <span>· {trend.sublabel}</span> : null}
        </div>
      ) : sublabel ? (
        <div className="mt-1 text-xs text-text-muted">{sublabel}</div>
      ) : null}
      {spark && spark.length > 1 ? (
        <Sparkline values={spark} toneClass={toneStroke[tone]} />
      ) : null}
    </div>
  );
}

function AnimatedValue({ value }: { value: string | number }) {
  const reduce = useReducedMotion();
  const motionValue = useMotionValue(typeof value === "number" ? 0 : 0);
  const rounded = useTransform(motionValue, (v) => Math.round(v).toString());

  useEffect(() => {
    if (typeof value !== "number") return;
    if (reduce) {
      motionValue.set(value);
      return;
    }
    const controls = animate(motionValue, value, {
      duration: DURATION_LONG,
      ease: EASE_OUT_EXPO,
    });
    return controls.stop;
  }, [value, reduce, motionValue]);

  if (typeof value !== "number") {
    return <span>{value}</span>;
  }
  return <motion.span>{rounded}</motion.span>;
}

const SPARK_WIDTH = 72;
const SPARK_HEIGHT = 10;

function sparkPath(values: number[]): string {
  if (values.length === 0) return "";
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const step = SPARK_WIDTH / Math.max(values.length - 1, 1);
  return values
    .map((v, i) => {
      const x = i * step;
      const y = SPARK_HEIGHT - ((v - min) / range) * SPARK_HEIGHT;
      return `${i === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(" ");
}

function Sparkline({ values, toneClass }: { values: number[]; toneClass: string }) {
  const reduce = useReducedMotion();
  return (
    <svg
      className="mt-2"
      width={SPARK_WIDTH}
      height={SPARK_HEIGHT}
      viewBox={`0 0 ${SPARK_WIDTH} ${SPARK_HEIGHT}`}
      fill="none"
      aria-hidden
    >
      <motion.path
        d={sparkPath(values)}
        className={toneClass}
        strokeWidth={1.25}
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={reduce ? false : { pathLength: 0 }}
        animate={reduce ? undefined : { pathLength: 1 }}
        transition={{ duration: DURATION_MEDIUM, ease: EASE_OUT_EXPO }}
      />
    </svg>
  );
}
