"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useCallback, useEffect, useRef, useState } from "react";

import { Check } from "@/components/icons";
import { DURATION_SHORT, EASE_OUT_EXPO } from "@/lib/motion";

interface RuleCodeBadgeProps {
  code: string;
  className?: string;
}

export function RuleCodeBadge({ code, className }: RuleCodeBadgeProps) {
  const reduce = useReducedMotion();
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard API unavailable (non-https, older browser). Silent fail —
      // the operator can still select + copy the code manually.
    }
  }, [code]);

  const transition = reduce
    ? { duration: 0 }
    : { duration: DURATION_SHORT, ease: EASE_OUT_EXPO };

  return (
    <button
      type="button"
      onClick={handleCopy}
      aria-label={copied ? `Rule code ${code} copied to clipboard` : `Copy rule code ${code}`}
      className={`inline-flex items-center rounded-md bg-surface-muted px-1.5 py-0.5 font-mono text-[11px] leading-5 text-text transition-colors hover:bg-surface-border/70 focus:outline-none focus:ring-1 focus:ring-brand-400 ${className ?? ""}`}
    >
      <AnimatePresence initial={false} mode="wait">
        {copied ? (
          <motion.span
            key="copied"
            className="inline-flex items-center gap-1 text-verified"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={transition}
          >
            <Check size={10} strokeWidth={3} aria-hidden />
            Copied
          </motion.span>
        ) : (
          <motion.span
            key="code"
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }}
            transition={transition}
          >
            {code}
          </motion.span>
        )}
      </AnimatePresence>
    </button>
  );
}
