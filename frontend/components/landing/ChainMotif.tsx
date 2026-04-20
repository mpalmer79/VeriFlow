"use client";

import { motion, useReducedMotion } from "framer-motion";

const LINK_COUNT = 5;
const LINK_W = 42;
const LINK_H = 18;
const PITCH = 26;
const STROKE = 1.25;

const TOTAL_W = PITCH * (LINK_COUNT - 1) + LINK_W;
const TOTAL_H = LINK_H;

export function ChainMotif({ className }: { className?: string }) {
  const reduce = useReducedMotion();

  return (
    <svg
      className={className}
      width={TOTAL_W}
      height={TOTAL_H}
      viewBox={`0 0 ${TOTAL_W} ${TOTAL_H}`}
      fill="none"
      stroke="currentColor"
      strokeWidth={STROKE}
      strokeLinecap="round"
      aria-hidden
    >
      {Array.from({ length: LINK_COUNT }).map((_, i) => {
        const cx = i * PITCH + LINK_W / 2;
        const cy = LINK_H / 2;
        const rx = (LINK_W - STROKE * 2) / 2;
        const ry = (LINK_H - STROKE * 2) / 2;
        return (
          <motion.ellipse
            key={i}
            cx={cx}
            cy={cy}
            rx={rx}
            ry={ry}
            initial={reduce ? false : { pathLength: 0, opacity: 0.25 }}
            animate={
              reduce
                ? { pathLength: 1, opacity: 0.55 }
                : { pathLength: [0, 1, 0], opacity: [0.25, 0.85, 0.25] }
            }
            transition={
              reduce
                ? { duration: 0 }
                : {
                    duration: 5.2,
                    delay: i * 0.42,
                    repeat: Infinity,
                    ease: "easeInOut",
                  }
            }
          />
        );
      })}
    </svg>
  );
}
