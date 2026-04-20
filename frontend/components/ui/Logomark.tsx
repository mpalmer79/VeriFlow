"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useEffect, useState } from "react";

import { DURATION_MEDIUM, EASE_OUT_EXPO } from "@/lib/motion";

interface LogomarkProps {
  className?: string;
  size?: number;
}

const SESSION_KEY = "veriflow.logomark.drawn";

// Two interlocking chevrons — the "V" pair in VeriFlow. The right
// chevron overshoots upward on its return leg so it reads as a check
// mark at the tail: verification inside the flow, not stamped on top.
const LEFT_D = "M5 9 L14 24 L16 21";
const RIGHT_D = "M12 9 L21 24 L27 13";

export function Logomark({ className, size = 24 }: LogomarkProps) {
  const reduce = useReducedMotion();
  const [shouldAnimate, setShouldAnimate] = useState(false);

  useEffect(() => {
    if (reduce) return;
    if (typeof window === "undefined") return;
    try {
      if (window.sessionStorage.getItem(SESSION_KEY)) return;
      window.sessionStorage.setItem(SESSION_KEY, "1");
      setShouldAnimate(true);
    } catch {
      // sessionStorage unavailable (private mode, etc.) — skip the draw.
    }
  }, [reduce]);

  const initial = shouldAnimate ? { pathLength: 0, opacity: 0.35 } : false;
  const animate = shouldAnimate ? { pathLength: 1, opacity: 1 } : undefined;

  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <motion.path
        d={LEFT_D}
        initial={initial}
        animate={animate}
        transition={{ duration: DURATION_MEDIUM, ease: EASE_OUT_EXPO }}
      />
      <motion.path
        d={RIGHT_D}
        initial={initial}
        animate={animate}
        transition={{
          duration: DURATION_MEDIUM,
          ease: EASE_OUT_EXPO,
          delay: shouldAnimate ? 0.12 : 0,
        }}
      />
    </svg>
  );
}
