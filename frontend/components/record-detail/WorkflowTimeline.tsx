"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useEffect, useRef, useState } from "react";

import { LoadingSkeleton } from "@/components/LoadingSkeleton";
import { Panel } from "@/components/Panel";
import {
  DURATION_LONG,
  DURATION_SHORT,
  EASE_OUT_EXPO,
  SPRING_SOFT,
} from "@/lib/motion";
import type { WorkflowStage } from "@/lib/types";

interface WorkflowTimelineProps {
  workflowName?: string;
  stages: WorkflowStage[] | null;
  currentStageId: number;
}

type StageKind = "past" | "current" | "future";

interface Enriched {
  stage: WorkflowStage;
  kind: StageKind;
  // A stage's inbound segment is past if the stage itself is past or current.
  inboundIsPast: boolean;
  isTerminal: boolean;
  terminalTone: "blocked" | "closed" | null;
}

function enrich(
  stages: WorkflowStage[],
  currentStageId: number,
): Enriched[] {
  const sorted = stages.slice().sort((a, b) => a.order_index - b.order_index);
  const current = sorted.find((s) => s.id === currentStageId);
  return sorted.map((stage) => {
    const kind: StageKind = !current
      ? "future"
      : stage.id === current.id
        ? "current"
        : stage.order_index < current.order_index
          ? "past"
          : "future";
    const inboundIsPast = kind !== "future";
    const slug = stage.slug.toLowerCase();
    const nameLower = stage.name.toLowerCase();
    const terminalTone: Enriched["terminalTone"] = stage.is_terminal
      ? slug.includes("block") || nameLower.includes("block")
        ? "blocked"
        : "closed"
      : null;
    return {
      stage,
      kind,
      inboundIsPast,
      isTerminal: stage.is_terminal,
      terminalTone,
    };
  });
}

export function WorkflowTimeline({
  workflowName,
  stages,
  currentStageId,
}: WorkflowTimelineProps) {
  return (
    <Panel
      title="Workflow progress"
      description={workflowName ?? "Stages in order, current stage highlighted."}
    >
      {!stages ? (
        <LoadingSkeleton rows={1} />
      ) : (
        <TimelineBody stages={stages} currentStageId={currentStageId} />
      )}
    </Panel>
  );
}

function TimelineBody({
  stages,
  currentStageId,
}: {
  stages: WorkflowStage[];
  currentStageId: number;
}) {
  const enriched = enrich(stages, currentStageId);
  const prevRef = useRef(currentStageId);
  const [justAdvancedToId, setJustAdvancedToId] = useState<number | null>(null);

  useEffect(() => {
    if (prevRef.current !== currentStageId) {
      setJustAdvancedToId(currentStageId);
      prevRef.current = currentStageId;
      const t = setTimeout(() => setJustAdvancedToId(null), DURATION_LONG * 1000 + 50);
      return () => clearTimeout(t);
    }
  }, [currentStageId]);

  return (
    <>
      <HorizontalTimeline
        enriched={enriched}
        justAdvancedToId={justAdvancedToId}
        className="hidden sm:block"
      />
      <VerticalTimeline
        enriched={enriched}
        justAdvancedToId={justAdvancedToId}
        className="sm:hidden"
      />
    </>
  );
}

function HorizontalTimeline({
  enriched,
  justAdvancedToId,
  className,
}: {
  enriched: Enriched[];
  justAdvancedToId: number | null;
  className?: string;
}) {
  return (
    <motion.ol
      layout
      className={`relative flex items-start ${className ?? ""}`}
      aria-label="Workflow stages"
    >
      {enriched.map((item, idx) => {
        const inbound = idx > 0 ? enriched[idx] : null;
        return (
          <motion.li
            layout
            key={item.stage.id}
            className="relative flex flex-1 flex-col items-center text-center last:flex-none"
          >
            {inbound ? (
              <Connector
                orientation="horizontal"
                isPast={inbound.inboundIsPast}
                animateFill={
                  justAdvancedToId === item.stage.id && item.kind === "current"
                }
              />
            ) : null}
            <Node
              kind={item.kind}
              terminalTone={item.terminalTone}
              isTerminal={item.isTerminal}
              justBecameCurrent={
                justAdvancedToId === item.stage.id && item.kind === "current"
              }
            />
            <Label name={item.stage.name} kind={item.kind} horizontal />
          </motion.li>
        );
      })}
    </motion.ol>
  );
}

function VerticalTimeline({
  enriched,
  justAdvancedToId,
  className,
}: {
  enriched: Enriched[];
  justAdvancedToId: number | null;
  className?: string;
}) {
  return (
    <motion.ol
      layout
      className={`relative flex flex-col ${className ?? ""}`}
      aria-label="Workflow stages"
    >
      {enriched.map((item, idx) => {
        const inbound = idx > 0 ? enriched[idx] : null;
        return (
          <motion.li
            layout
            key={item.stage.id}
            className="relative flex items-start gap-3"
          >
            <div className="relative flex w-5 shrink-0 flex-col items-center">
              {inbound ? (
                <Connector
                  orientation="vertical"
                  isPast={inbound.inboundIsPast}
                  animateFill={
                    justAdvancedToId === item.stage.id && item.kind === "current"
                  }
                />
              ) : (
                <span className="h-3" />
              )}
              <Node
                kind={item.kind}
                terminalTone={item.terminalTone}
                isTerminal={item.isTerminal}
                justBecameCurrent={
                  justAdvancedToId === item.stage.id && item.kind === "current"
                }
              />
            </div>
            <Label name={item.stage.name} kind={item.kind} horizontal={false} />
          </motion.li>
        );
      })}
    </motion.ol>
  );
}

const nodeFill: Record<StageKind, string> = {
  past: "bg-verified border-verified",
  current: "bg-brand-500 border-brand-400",
  future: "bg-transparent border-text-muted/60",
};

function Node({
  kind,
  terminalTone,
  isTerminal,
  justBecameCurrent,
}: {
  kind: StageKind;
  terminalTone: Enriched["terminalTone"];
  isTerminal: boolean;
  justBecameCurrent: boolean;
}) {
  const reduce = useReducedMotion();

  let fillCls = nodeFill[kind];
  if (isTerminal && kind !== "current") {
    if (terminalTone === "blocked") {
      fillCls =
        kind === "past"
          ? "bg-severity-critical border-severity-critical"
          : "bg-transparent border-severity-critical/60";
    } else {
      fillCls =
        kind === "past"
          ? "bg-text-subtle border-text-subtle"
          : "bg-transparent border-text-subtle/60";
    }
  }

  const shapeCls = isTerminal ? "rounded-[2px]" : "rounded-full";

  return (
    <span className="relative flex h-2 w-2 items-center justify-center">
      {/* Ring around the current node. Scales in on transition. */}
      {kind === "current" ? (
        <motion.span
          aria-hidden
          className="absolute inset-[-3px] rounded-full border-2 border-brand-400/80"
          initial={
            reduce || !justBecameCurrent ? false : { scale: 0.6, opacity: 0 }
          }
          animate={{ scale: 1, opacity: 1 }}
          transition={reduce ? { duration: 0 } : SPRING_SOFT}
          style={isTerminal ? { borderRadius: 4 } : undefined}
        />
      ) : null}
      <motion.span
        aria-hidden
        className={`block h-2 w-2 border ${fillCls} ${shapeCls}`}
        animate={{}}
        transition={
          reduce ? { duration: 0 } : { duration: DURATION_SHORT, ease: "easeOut" }
        }
      />
    </span>
  );
}

function Label({
  name,
  kind,
  horizontal,
}: {
  name: string;
  kind: StageKind;
  horizontal: boolean;
}) {
  const toneCls =
    kind === "current"
      ? "text-text"
      : kind === "past"
        ? "text-text-muted"
        : "text-text-subtle";
  if (horizontal) {
    return (
      <span
        className={`mt-2 max-w-[9rem] truncate text-xs ${toneCls}`}
        title={name}
      >
        {name}
      </span>
    );
  }
  return (
    <span className={`py-0.5 text-sm ${toneCls}`} title={name}>
      {name}
    </span>
  );
}

function Connector({
  orientation,
  isPast,
  animateFill,
}: {
  orientation: "horizontal" | "vertical";
  isPast: boolean;
  animateFill: boolean;
}) {
  const reduce = useReducedMotion();
  const base =
    orientation === "horizontal"
      ? "absolute left-[calc(-50%+4px)] right-[calc(50%+4px)] top-[3px] h-px"
      : "h-3 w-px";
  const pastCls = "bg-verified";
  const futureCls =
    orientation === "horizontal"
      ? "border-t border-dashed border-text-subtle/50 bg-transparent"
      : "border-l border-dashed border-text-subtle/50 bg-transparent";

  if (isPast) {
    return (
      <span className={`${base} ${pastCls} overflow-hidden`} aria-hidden>
        {animateFill ? (
          <motion.span
            className="block h-full w-full origin-left bg-verified"
            initial={reduce ? false : { scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={
              reduce
                ? { duration: 0 }
                : { duration: DURATION_LONG, ease: EASE_OUT_EXPO }
            }
            style={
              orientation === "vertical"
                ? { transformOrigin: "top", width: "1px", height: "100%" }
                : undefined
            }
          />
        ) : null}
      </span>
    );
  }
  return <span className={`${base} ${futureCls}`} aria-hidden />;
}
