"use client";

import { motion, useReducedMotion } from "framer-motion";
import type { ReactNode } from "react";

import type { LucideIcon } from "@/components/icons";
import { DURATION_SHORT, EASE_OUT, overlayFade } from "@/lib/motion";

interface EmptyStateProps {
  title: string;
  description?: string;
  icon?: LucideIcon;
  children?: ReactNode;
}

export function EmptyState({ title, description, icon: Icon, children }: EmptyStateProps) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      variants={overlayFade}
      initial="hidden"
      animate="visible"
      transition={reduce ? { duration: 0 } : { duration: DURATION_SHORT, ease: EASE_OUT }}
      className="flex flex-col items-center justify-center gap-2 rounded-md border border-dashed border-surface-border bg-surface-muted/40 px-6 py-10 text-center"
    >
      {Icon ? <Icon size={32} className="text-text-subtle" aria-hidden /> : null}
      <div className="text-sm font-medium text-text">{title}</div>
      {description ? (
        <p className="max-w-sm text-xs text-text-muted">{description}</p>
      ) : null}
      {children}
    </motion.div>
  );
}
