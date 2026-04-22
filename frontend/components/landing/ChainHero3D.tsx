"use client";

import { motion, useReducedMotion } from "framer-motion";
import {
  useEffect,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
} from "react";

import {
  DURATION_MEDIUM,
  EASE_OUT_EXPO,
  fadeRise,
} from "@/lib/motion";

interface ChainHero3DProps {
  className?: string;
}

interface Link3DProps {
  index: number;
  total: number;
  yaw: number;
  label: string;
  pulse: boolean;
}

const LINK_COUNT = 9;
const LINK_PITCH_PX = 72;
const LINK_WIDTH_PX = 132;
const LINK_HEIGHT_PX = 70;
const HEIGHT_PX = 440;
const PERSPECTIVE_PX = 1400;

const YAW_BASE_DEG = -22;
const YAW_SWING_DEG = 28;
const PITCH_BASE_DEG = 14;
const PITCH_MIN_DEG = -10;
const PITCH_MAX_DEG = 50;

const STAR_COUNT = 40;

const LINK_LABELS = [
  "a1b6",
  "9c3f",
  "64a2",
  "1d8e",
  "3a6f",
  "40c8",
  "88d1",
  "c9f3",
  "2e11",
] as const;

function Link3D({ index, total, yaw, label, pulse }: Link3DProps) {
  const z = (index - (total - 1) / 2) * LINK_PITCH_PX;
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
            "0 0 30px rgb(var(--color-brand-400) / 0.45), inset 0 0 14px rgb(var(--color-brand-600) / 0.3)",
          animationDelay: pulse ? `${index * 0.22}s` : undefined,
          position: "relative",
          transformStyle: "preserve-3d",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: 9999,
            border: "1px solid rgb(var(--color-brand-400) / 0.4)",
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
        {label}…
      </div>
    </div>
  );
}

export function ChainHero3D({ className }: ChainHero3DProps): JSX.Element {
  const reduce = useReducedMotion() ?? false;

  const [yaw, setYaw] = useState<number>(YAW_BASE_DEG);
  const [pitch, setPitch] = useState<number>(PITCH_BASE_DEG);
  const [isDragging, setIsDragging] = useState<boolean>(false);

  const draggingRef = useRef<boolean>(false);
  const lastPointRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const hoverRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const stageRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (reduce) return;
    const stage = stageRef.current;
    let raf = 0;
    const t0 = performance.now();

    const tick = (t: number) => {
      if (!draggingRef.current) {
        const dt = (t - t0) / 1000;
        const target = YAW_BASE_DEG + Math.sin(dt * 0.4) * YAW_SWING_DEG;
        setYaw((y) => y + (target - y) * 0.04);
        const parallax = hoverRef.current.y * 10;
        setPitch((p) => p + (PITCH_BASE_DEG + parallax - p) * 0.08);
      }
      raf = requestAnimationFrame(tick);
    };

    const start = () => {
      if (!raf) raf = requestAnimationFrame(tick);
    };
    const stop = () => {
      if (raf) {
        cancelAnimationFrame(raf);
        raf = 0;
      }
    };

    let observer: IntersectionObserver | null = null;
    const canObserve =
      typeof window !== "undefined" && "IntersectionObserver" in window && stage !== null;
    if (canObserve && stage) {
      observer = new IntersectionObserver(
        (entries) => {
          const entry = entries[0];
          if (!entry) return;
          if (entry.intersectionRatio >= 0.1) start();
          else stop();
        },
        { threshold: [0, 0.1, 1] },
      );
      observer.observe(stage);
    } else {
      start();
    }

    return () => {
      stop();
      observer?.disconnect();
    };
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
      setPitch((p) =>
        Math.max(PITCH_MIN_DEG, Math.min(PITCH_MAX_DEG, p - dy * 0.3)),
      );
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

  const effectiveYaw = reduce ? YAW_BASE_DEG : yaw;
  const effectivePitch = reduce ? PITCH_BASE_DEG : pitch;
  const hoverX = reduce ? 0 : hoverRef.current.x;

  return (
    <motion.div
      variants={fadeRise}
      transition={{ duration: DURATION_MEDIUM, ease: EASE_OUT_EXPO }}
      className={className}
    >
      <div
        ref={stageRef}
        onMouseDown={onStageMouseDown}
        onMouseMove={onStageMouseMove}
        className="relative overflow-hidden rounded-lg border border-surface-border bg-surface-muted"
        style={{
          height: HEIGHT_PX,
          perspective: `${PERSPECTIVE_PX}px`,
          cursor: reduce ? "default" : isDragging ? "grabbing" : "grab",
          backgroundImage: `radial-gradient(ellipse at ${50 + hoverX * 20}% 0%, rgb(var(--color-brand-600) / 0.28), transparent 60%), radial-gradient(ellipse at 80% 100%, rgb(var(--color-brand-400) / 0.14), transparent 50%)`,
        }}
      >
        {/* Ambient star field */}
        {Array.from({ length: STAR_COUNT }).map((_, i) => {
          const left = (i * 137.5) % 100;
          const top = (i * 76.9) % 100;
          const pulseStar = !reduce;
          return (
            <div
              key={i}
              aria-hidden
              className={pulseStar ? "animate-chain-pulse" : undefined}
              style={{
                position: "absolute",
                left: `${left}%`,
                top: `${top}%`,
                width: 2,
                height: 2,
                borderRadius: 9999,
                background: "rgb(var(--color-brand-400) / 0.5)",
                animationDuration: pulseStar ? `${2 + (i % 5)}s` : undefined,
                animationDelay: pulseStar ? `${i * 0.1}s` : undefined,
                pointerEvents: "none",
              }}
            />
          );
        })}

        {/* Horizon grid floor */}
        {!reduce ? (
          <div
            aria-hidden
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              bottom: 0,
              height: 200,
              transform: "rotateX(68deg) translateZ(-20px)",
              transformOrigin: "bottom",
              backgroundImage:
                "linear-gradient(rgb(var(--color-brand-400) / 0.22) 1px, transparent 1px), linear-gradient(90deg, rgb(var(--color-brand-400) / 0.22) 1px, transparent 1px)",
              backgroundSize: "48px 48px",
              maskImage:
                "linear-gradient(180deg, transparent, black 40%, black)",
              WebkitMaskImage:
                "linear-gradient(180deg, transparent, black 40%, black)",
              pointerEvents: "none",
            }}
          />
        ) : null}

        {/* Chain stage */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            transformStyle: "preserve-3d",
            transform: `rotateX(${effectivePitch}deg)`,
            pointerEvents: "none",
          }}
        >
          {Array.from({ length: LINK_COUNT }).map((_, i) => (
            <Link3D
              key={i}
              index={i}
              total={LINK_COUNT}
              yaw={effectiveYaw}
              label={LINK_LABELS[i % LINK_LABELS.length] ?? "0000"}
              pulse={!reduce}
            />
          ))}
        </div>

        {/* Top-left overlay */}
        <div
          className="pointer-events-none absolute left-4 top-3 flex items-center gap-2"
          style={{ fontSize: 11, color: "rgb(var(--color-text-muted))" }}
        >
          <span
            className="text-brand-400"
            style={{
              letterSpacing: "0.18em",
              fontWeight: 600,
              textTransform: "uppercase",
            }}
          >
            Evidence chain
          </span>
          {!reduce ? (
            <span className="font-mono tabular-nums text-[11px]">
              · drag to rotate
            </span>
          ) : null}
        </div>

        {/* Bottom-right readout */}
        {!reduce ? (
          <div
            className="pointer-events-none absolute bottom-2.5 right-3 font-mono tabular-nums text-text-subtle"
            style={{ fontSize: 10 }}
          >
            yaw {yaw.toFixed(0)}° · pitch {pitch.toFixed(0)}°
          </div>
        ) : null}
      </div>
    </motion.div>
  );
}
