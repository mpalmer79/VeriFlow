// Motion vocabulary for VeriFlow. Import from here; do not hand-roll
// transitions at call sites.

import { useReducedMotion, type Transition, type Variants } from "framer-motion";
import { useMemo } from "react";

export const DURATION_MICRO = 0.12;
export const DURATION_SHORT = 0.22;
export const DURATION_MEDIUM = 0.38;
export const DURATION_LONG = 0.62;

export const EASE_OUT_EXPO = [0.22, 1, 0.36, 1] as const;
export const EASE_OUT = "easeOut" as const;

export const SPRING_DEFAULT: Transition = {
  type: "spring",
  stiffness: 300,
  damping: 30,
};

export const SPRING_SOFT: Transition = {
  type: "spring",
  stiffness: 180,
  damping: 26,
};

export const STAGGER_TIGHT = 0.025;
export const STAGGER_DEFAULT = 0.04;

export const fadeRise: Variants = {
  hidden: { opacity: 0, y: 6 },
  visible: { opacity: 1, y: 0 },
};

export const fadeRiseSlow: Variants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0 },
};

export const overlayFade: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
};

export const dialogPop: Variants = {
  hidden: { opacity: 0, y: 8, scale: 0.98 },
  visible: { opacity: 1, y: 0, scale: 1 },
  exit: { opacity: 0, y: 8, scale: 0.98 },
};

export const staggerParent: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: STAGGER_DEFAULT } },
};

export const staggerParentTight: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: STAGGER_TIGHT } },
};

export type MotionPreset = "spring" | "softSpring" | "easeOut" | "expoOut";

export function useMotionTransition(
  preset: MotionPreset = "spring",
  overrides?: Transition,
): Transition {
  const reduce = useReducedMotion();
  return useMemo<Transition>(() => {
    if (reduce) return { duration: 0 };
    switch (preset) {
      case "spring":
        return { ...SPRING_DEFAULT, ...overrides };
      case "softSpring":
        return { ...SPRING_SOFT, ...overrides };
      case "expoOut":
        return {
          duration: DURATION_MEDIUM,
          ease: EASE_OUT_EXPO,
          ...overrides,
        };
      case "easeOut":
      default:
        return {
          duration: DURATION_SHORT,
          ease: EASE_OUT,
          ...overrides,
        };
    }
    // overrides is typically a stable object; callers that pass a fresh
    // object every render will recompute, which matches the behaviour of
    // inline transition props.
  }, [reduce, preset, overrides]);
}
