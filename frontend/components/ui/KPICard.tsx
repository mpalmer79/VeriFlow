"use client";

import Link from "next/link";

import { ChevronRight, type LucideIcon } from "@/components/icons";
import { AnimatedNumber } from "@/components/ui/AnimatedNumber";

export type KPITone = "neutral" | "critical" | "warning" | "ok";

interface KPICardProps {
  label: string;
  value: string | number;
  sublabel?: string;
  tone?: KPITone;
  icon?: LucideIcon;
  highlighted?: boolean;
  /**
   * When provided, the card renders as a Next.js Link with hover/focus
   * affordances and a chevron indicator. When omitted the card renders
   * as a plain div (display-only).
   */
  href?: string;
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
  href,
}: KPICardProps) {
  // Interactive affordance is opt-in via href. The global prefers-
  // reduced-motion rule in app/globals.css clamps transition-opacity
  // to 1ms so the chevron snaps rather than fades under that setting.
  const interactiveClasses = href
    ? "group cursor-pointer transition-colors hover:border-text-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-300"
    : "";

  const baseClassName = `panel relative flex flex-col justify-between p-5 sm:p-6 ${
    highlighted ? highlightBorder[tone] : ""
  } ${interactiveClasses}`.trim();

  // Chevron sits bottom-right when the tone icon already occupies
  // top-right, top-right otherwise. Sublabels in the dashboard cards
  // are short (≤ ~3 words) so there's no horizontal overlap at the
  // widths this component renders at.
  const chevronPosition = Icon ? "bottom-4 right-4" : "top-4 right-4";

  const body = (
    <>
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
      {href ? (
        <ChevronRight
          size={16}
          aria-hidden
          className={`pointer-events-none absolute ${chevronPosition} text-text-muted/40 opacity-0 transition-opacity group-hover:text-text-muted group-hover:opacity-100 group-focus-visible:opacity-100`}
        />
      ) : null}
    </>
  );

  if (href) {
    return (
      <Link
        href={href}
        aria-label={`View records matching ${label}`}
        className={baseClassName}
      >
        {body}
      </Link>
    );
  }

  return <div className={baseClassName}>{body}</div>;
}
