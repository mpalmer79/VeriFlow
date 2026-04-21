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


// Named intent presets (Phase 5). Each preset packages an initial /
// animate / optional exit / transition bundle so call sites can say
// `const preset = useMotionPreset("slideUp")` and splat it into a
// motion.div without repeating the shape. The existing named
// variants (fadeRise, dialogPop, …) are still the right tool when
// you want to drive variants via a parent's `variants`; presets are
// for the single-component case.

interface MotionPresetShape {
  initial: Record<string, number>;
  animate: Record<string, number>;
  exit?: Record<string, number>;
  transition: Transition;
}

export type MotionPresetName =
  | "fadeRise"
  | "fadeRiseSlow"
  | "slideUp"
  | "slideDown"
  | "scaleIn"
  | "dialogPop"
  | "overlayFade"
  | "listStagger";

export const MOTION_PRESETS: Readonly<Record<MotionPresetName, MotionPresetShape>> =
  Object.freeze({
    fadeRise: {
      initial: { opacity: 0, y: 6 },
      animate: { opacity: 1, y: 0 },
      transition: { ...SPRING_DEFAULT },
    },
    fadeRiseSlow: {
      initial: { opacity: 0, y: 12 },
      animate: { opacity: 1, y: 0 },
      transition: { duration: DURATION_MEDIUM, ease: EASE_OUT_EXPO as unknown as number[] },
    },
    slideUp: {
      initial: { opacity: 0, y: 10 },
      animate: { opacity: 1, y: 0 },
      exit: { opacity: 0, y: -6 },
      transition: { duration: DURATION_SHORT, ease: EASE_OUT_EXPO as unknown as number[] },
    },
    slideDown: {
      initial: { opacity: 0, y: -10 },
      animate: { opacity: 1, y: 0 },
      exit: { opacity: 0, y: 6 },
      transition: { duration: DURATION_SHORT, ease: EASE_OUT_EXPO as unknown as number[] },
    },
    scaleIn: {
      initial: { opacity: 0, scale: 0.95 },
      animate: { opacity: 1, scale: 1 },
      exit: { opacity: 0, scale: 0.95 },
      transition: { duration: DURATION_MICRO, ease: "easeOut" as unknown as number[] },
    },
    dialogPop: {
      initial: { opacity: 0, y: 8, scale: 0.98 },
      animate: { opacity: 1, y: 0, scale: 1 },
      exit: { opacity: 0, y: 8, scale: 0.98 },
      transition: { duration: DURATION_MICRO, ease: "easeOut" as unknown as number[] },
    },
    overlayFade: {
      initial: { opacity: 0 },
      animate: { opacity: 1 },
      exit: { opacity: 0 },
      transition: { duration: DURATION_SHORT, ease: "easeOut" as unknown as number[] },
    },
    listStagger: {
      // The parent in a list-stagger uses `transition.staggerChildren`
      // on its visible variant; the initial/animate here are the
      // identity shapes so `motion.ul variants={fadeRise}` still works
      // when the parent happens to use this preset inline.
      initial: { opacity: 1 },
      animate: { opacity: 1 },
      transition: { staggerChildren: STAGGER_DEFAULT },
    },
  });


export function useMotionPreset(name: MotionPresetName): MotionPresetShape {
  const reduce = useReducedMotion();
  return useMemo<MotionPresetShape>(() => {
    const base = MOTION_PRESETS[name];
    if (!reduce) return base;
    // Reduced motion: collapse the transition to an instant state
    // change. initial/animate/exit retain their shapes; the duration-0
    // transition makes Framer Motion jump straight to the animate state.
    return { ...base, transition: { duration: 0 } };
  }, [name, reduce]);
}
