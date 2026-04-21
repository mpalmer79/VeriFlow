"use client";

import { motion, useReducedMotion } from "framer-motion";
import type { KeyboardEvent } from "react";

import { useTheme, type Theme } from "@/components/theme/ThemeProvider";

const OPTIONS: ReadonlyArray<{ value: Theme; label: string }> = [
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
];

interface ThemeToggleProps {
  /** "full" shows labels; "compact" is icon-only for header placements. */
  variant?: "full" | "compact";
}

function SunIcon({ size = 16 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="12" cy="12" r="4" />
      <path d="M12 3v2" />
      <path d="M12 19v2" />
      <path d="M4.93 4.93l1.41 1.41" />
      <path d="M17.66 17.66l1.41 1.41" />
      <path d="M3 12h2" />
      <path d="M19 12h2" />
      <path d="M4.93 19.07l1.41-1.41" />
      <path d="M17.66 6.34l1.41-1.41" />
    </svg>
  );
}

function MoonIcon({ size = 16 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  );
}

export function ThemeToggle({ variant = "full" }: ThemeToggleProps) {
  const { theme, setTheme } = useTheme();
  const reduce = useReducedMotion();

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
      e.preventDefault();
      const idx = OPTIONS.findIndex((o) => o.value === theme);
      const next =
        e.key === "ArrowRight"
          ? OPTIONS[(idx + 1) % OPTIONS.length].value
          : OPTIONS[(idx - 1 + OPTIONS.length) % OPTIONS.length].value;
      setTheme(next);
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      setTheme(theme === "dark" ? "light" : "dark");
    }
  }

  if (variant === "compact") {
    const nextTheme = theme === "dark" ? "light" : "dark";
    return (
      <button
        type="button"
        aria-label={`Switch to ${nextTheme} theme`}
        onClick={() => setTheme(nextTheme)}
        className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-surface-border text-text-muted transition-colors hover:border-text-subtle hover:text-text focus:outline-none focus:ring-1 focus:ring-brand-400"
      >
        {theme === "dark" ? <SunIcon size={14} /> : <MoonIcon size={14} />}
      </button>
    );
  }

  return (
    <div
      role="radiogroup"
      aria-label="Theme"
      onKeyDown={onKeyDown}
      tabIndex={0}
      className="relative inline-flex h-9 w-[88px] items-center rounded-full border border-surface-border bg-surface-muted p-0.5 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-brand-400"
    >
      {OPTIONS.map((option) => {
        const active = option.value === theme;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={`${option.label} theme`}
            onClick={() => setTheme(option.value)}
            className={`relative z-10 flex h-full flex-1 items-center justify-center gap-1 rounded-full transition-colors ${
              active ? "text-text" : "text-text-muted"
            }`}
          >
            {option.value === "light" ? (
              <SunIcon size={12} />
            ) : (
              <MoonIcon size={12} />
            )}
            <span>{option.label}</span>
            {active ? (
              <motion.span
                layoutId="theme-toggle-pill"
                aria-hidden
                className="absolute inset-0 -z-10 rounded-full bg-surface-panel shadow-sm"
                transition={
                  reduce
                    ? { duration: 0 }
                    : { type: "spring", stiffness: 380, damping: 30 }
                }
              />
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
