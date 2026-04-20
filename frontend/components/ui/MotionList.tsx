"use client";

import { LayoutGroup, motion, type HTMLMotionProps, type Variants } from "framer-motion";
import { Children, type ReactNode } from "react";

import { staggerParent, staggerParentTight } from "@/lib/motion";

type MotionListAs = "ul" | "ol" | "div" | "tbody";

interface MotionListProps {
  as?: MotionListAs;
  staggerWhen?: "mount" | "children-change";
  tight?: boolean;
  className?: string;
  children: ReactNode;
}

export function MotionList({
  as = "div",
  staggerWhen = "mount",
  tight = false,
  className,
  children,
}: MotionListProps) {
  const variants: Variants = tight ? staggerParentTight : staggerParent;
  // children-change remounts the container when the child count shifts so
  // the stagger replays on filter/sort changes. LayoutGroup wrapping lets
  // individual children with `layout` still animate position smoothly
  // while they remain mounted; only the outer container resets.
  const resetKey =
    staggerWhen === "children-change" ? Children.count(children) : undefined;

  const common = {
    key: resetKey,
    className,
    variants,
    initial: "hidden",
    animate: "visible",
  } as const;

  return (
    <LayoutGroup>
      {renderMotion(as, common, children)}
    </LayoutGroup>
  );
}

function renderMotion(
  as: MotionListAs,
  common: Pick<HTMLMotionProps<"div">, "className" | "variants" | "initial" | "animate"> & { key?: number },
  children: ReactNode,
) {
  switch (as) {
    case "ul":
      return <motion.ul {...common}>{children}</motion.ul>;
    case "ol":
      return <motion.ol {...common}>{children}</motion.ol>;
    case "tbody":
      return <motion.tbody {...common}>{children}</motion.tbody>;
    case "div":
    default:
      return <motion.div {...common}>{children}</motion.div>;
  }
}
