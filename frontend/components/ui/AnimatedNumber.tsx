"use client";

import {
  animate,
  motion,
  useMotionValue,
  useReducedMotion,
  useTransform,
} from "framer-motion";
import { useEffect } from "react";

import { DURATION_LONG, EASE_OUT_EXPO } from "@/lib/motion";

interface AnimatedNumberProps {
  value: number | string;
  className?: string;
}

export function AnimatedNumber({ value, className }: AnimatedNumberProps) {
  const reduce = useReducedMotion();
  const motionValue = useMotionValue(0);
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
    return <span className={className}>{value}</span>;
  }
  return <motion.span className={className}>{rounded}</motion.span>;
}
