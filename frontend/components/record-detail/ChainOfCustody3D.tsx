"use client";

import { useEffect, useRef, useState, type MouseEvent as ReactMouseEvent } from "react";
import { useReducedMotion } from "framer-motion";

import type { AuditEntry } from "@/lib/types";

interface ChainOfCustody3DProps {
  entries: AuditEntry[];
  maxLinks?: number;
  height?: number;
}

interface LinkProps {
  index: number;
  total: number;
  yaw: number;
  label: string;
  pulse: boolean;
}

const LINK_PITCH_PX = 48;
const LINK_WIDTH_PX = 96;
const LINK_HEIGHT_PX = 54;
const PERSPECTIVE_PX = 1100;
const YAW_BASE_DEG = -22;
const PITCH_BASE_DEG = 14;
const PITCH_MIN_DEG = -10;
const PITCH_MAX_DEG = 50;

function linkLabelFor(entry: AuditEntry): string {
  const hex = entry.id.toString(16).padStart(4, "0");
  return `${hex.slice(0, 4)}…`;
}

function Link3D({ index, total, yaw, label, pulse }: LinkProps) {
  const z = (index - (total - 1) / 2) * LINK_PITCH_PX;
  const delay = `${index * 0.22}s`;
  const fogOpacity = 1 - (Math.abs(index - (total - 1) / 2) / total) * 0.5;
  return (
    <div
      style={{
        position: "absolute",
        left: "50%",
        top: "50%",
        transform: `translate(-50%, -50%) rotateY(${yaw}deg) translateZ(${z}px) rotateY(${-yaw}deg)`,
        transformStyle: "preserve-3d",
        opacity: fogOpacity,
      }}
    >
      <div
        className={pulse ? "animate-chain-pulse" : undefined}
        style={{
          width: LINK_WIDTH_PX,
          height: LINK_HEIGHT_PX,
          borderRadius: 9999,
          border: "2px solid rgb(var(--color-brand-400))",
          background:
            "radial-gradient(ellipse at center, rgb(var(--color-brand-600) / 0.22), transparent 70%)",
          boxShadow:
            "0 0 30px rgb(var(--color-brand-400) / 0.45), inset 0 0 14px rgb(var(--color-brand-600) / 0.30)",
          animationDelay: pulse ? delay : undefined,
          position: "relative",
          transformStyle: "preserve-3d",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: 9999,
            border: "1px solid rgb(var(--color-brand-400) / 0.40)",
            transform: "rotateX(90deg)",
          }}
        />
        <div
          style={{
            position: "absolute",
            inset: -2,
            borderRadius: 9999,
            border: "1px solid rgb(var(--color-brand-400) / 0.15)",
            transform: "rotateX(45deg) rotateY(30deg)",
          }}
        />
      </div>
      <div
        className="font-mono tabular-nums text-text-muted"
        style={{
          position: "absolute",
          top: "100%",
          left: "50%",
          transform: "translate(-50%, 8px)",
          fontSize: 10,
          whiteSpace: "nowrap",
          letterSpacing: "0.04em",
        }}
      >
        {label}
      </div>
    </div>
  );
}

export function ChainOfCustody3D({
  entries,
  maxLinks = 9,
  height = 280,
}: ChainOfCustody3DProps): JSX.Element {
  const reduce = useReducedMotion() ?? false;

  // Cap the displayed entries at `maxLinks`, preferring the most recent ones.
  // Reverse so the newest entry sits on the right end of the chain — the
  // audit list above is newest-first and the chain reads left-to-right.
  const linked = entries.slice(0, maxLinks).reverse();

  const [yaw, setYaw] = useState<number>(YAW_BASE_DEG);
  const [pitch, setPitch] = useState<number>(PITCH_BASE_DEG);
  const [isDragging, setIsDragging] = useState<boolean>(false);

  const draggingRef = useRef<boolean>(false);
  const lastPointRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const hoverRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const stageRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (reduce) return;
    let raf = 0;
    const t0 = performance.now();
    const tick = (t: number) => {
      if (!draggingRef.current) {
        const dt = (t - t0) / 1000;
        const target = YAW_BASE_DEG + Math.sin(dt * 0.4) * 10;
        setYaw((y) => y + (target - y) * 0.04);
        const parallax = hoverRef.current.y * 10;
        setPitch((p) => p + (PITCH_BASE_DEG + parallax - p) * 0.08);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [reduce]);

  useEffect(() => {
    if (reduce) return;
    const onWindowUp = () => {
      draggingRef.current = false;
      setIsDragging(false);
    };
    const onWindowMove = (e: MouseEvent) => {
      if (!draggingRef.current) return;
      const dx = e.clientX - lastPointRef.current.x;
      const dy = e.clientY - lastPointRef.current.y;
      setYaw((y) => y + dx * 0.6);
      setPitch((p) => Math.max(PITCH_MIN_DEG, Math.min(PITCH_MAX_DEG, p - dy * 0.3)));
      lastPointRef.current = { x: e.clientX, y: e.clientY };
    };
    window.addEventListener("mouseup", onWindowUp);
    window.addEventListener("mousemove", onWindowMove);
    return () => {
      window.removeEventListener("mouseup", onWindowUp);
      window.removeEventListener("mousemove", onWindowMove);
    };
  }, [reduce]);

  const onStageMouseDown = (e: ReactMouseEvent<HTMLDivElement>) => {
    if (reduce) return;
    draggingRef.current = true;
    setIsDragging(true);
    lastPointRef.current = { x: e.clientX, y: e.clientY };
  };

  const onStageMouseMove = (e: ReactMouseEvent<HTMLDivElement>) => {
    if (reduce || draggingRef.current) return;
    const rect = stageRef.current?.getBoundingClientRect();
    if (!rect) return;
    hoverRef.current = {
      x: (e.clientX - rect.left) / rect.width - 0.5,
      y: (e.clientY - rect.top) / rect.height - 0.5,
    };
  };

  if (linked.length === 0) {
    return (
      <div
        className="flex items-center justify-center rounded-lg border border-surface-border bg-surface-muted text-sm text-text-muted"
        style={{ height }}
      >
        No audit entries yet.
      </div>
    );
  }

  const effectiveYaw = reduce ? YAW_BASE_DEG : yaw;
  const effectivePitch = reduce ? PITCH_BASE_DEG : pitch;

  return (
    <div
      ref={stageRef}
      onMouseDown={onStageMouseDown}
      onMouseMove={onStageMouseMove}
      className="relative overflow-hidden rounded-lg border border-surface-border bg-surface-muted"
      style={{
        height,
        perspective: `${PERSPECTIVE_PX}px`,
        cursor: reduce ? "default" : isDragging ? "grabbing" : "grab",
        backgroundImage:
          "radial-gradient(ellipse at 50% 0%, rgb(var(--color-brand-600) / 0.28), transparent 60%), radial-gradient(ellipse at 80% 100%, rgb(var(--color-brand-400) / 0.14), transparent 50%)",
      }}
    >
      {!reduce ? (
        <div
          aria-hidden
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 0,
            height: 120,
            transform: "rotateX(68deg) translateZ(-20px)",
            transformOrigin: "bottom",
            backgroundImage:
              "linear-gradient(rgb(var(--color-brand-400) / 0.22) 1px, transparent 1px), linear-gradient(90deg, rgb(var(--color-brand-400) / 0.22) 1px, transparent 1px)",
            backgroundSize: "48px 48px",
            maskImage: "linear-gradient(180deg, transparent, black 40%, black)",
            WebkitMaskImage:
              "linear-gradient(180deg, transparent, black 40%, black)",
            pointerEvents: "none",
          }}
        />
      ) : null}

      <div
        style={{
          position: "absolute",
          inset: 0,
          transformStyle: "preserve-3d",
          transform: `rotateX(${effectivePitch}deg)`,
          pointerEvents: "none",
        }}
      >
        {linked.map((entry, i) => (
          <Link3D
            key={entry.id}
            index={i}
            total={linked.length}
            yaw={effectiveYaw}
            label={linkLabelFor(entry)}
            pulse={!reduce}
          />
        ))}
      </div>

      <div
        className="pointer-events-none absolute left-4 top-3 flex items-center gap-2"
        style={{ fontSize: 11, color: "rgb(var(--color-text-muted))" }}
      >
        <span
          className="text-brand-400"
          style={{ letterSpacing: "0.18em", fontWeight: 600, textTransform: "uppercase" }}
        >
          Evidence chain
        </span>
        {!reduce ? (
          <span className="font-mono tabular-nums">· drag to rotate</span>
        ) : null}
      </div>

      {!reduce ? (
        <div
          className="pointer-events-none absolute bottom-2.5 right-3 font-mono tabular-nums text-text-subtle"
          style={{ fontSize: 10 }}
        >
          yaw {yaw.toFixed(0)}° · pitch {pitch.toFixed(0)}°
        </div>
      ) : null}
    </div>
  );
}
