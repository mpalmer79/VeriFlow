import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        surface: {
          DEFAULT: "#0b1220",
          panel: "#0f172a",
          muted: "#111c33",
          border: "#1f2a44",
        },
        text: {
          DEFAULT: "#e6edf3",
          muted: "#94a3b8",
          subtle: "#64748b",
        },
        accent: {
          DEFAULT: "#3b82f6",
          strong: "#2563eb",
        },
        severity: {
          low: "#22c55e",
          moderate: "#eab308",
          high: "#f97316",
          critical: "#ef4444",
        },
      },
      fontFamily: {
        sans: [
          "var(--font-sans)",
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "Roboto",
          "Helvetica",
          "Arial",
          "sans-serif",
        ],
        mono: [
          "var(--font-mono)",
          "ui-monospace",
          "SFMono-Regular",
          "Menlo",
          "monospace",
        ],
      },
      keyframes: {
        "fade-in": {
          "0%": { opacity: "0", transform: "translateY(4px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "fade-in-slow": {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "overlay-in": {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        "dialog-in": {
          "0%": { opacity: "0", transform: "translateY(6px) scale(0.98)" },
          "100%": { opacity: "1", transform: "translateY(0) scale(1)" },
        },
      },
      animation: {
        "fade-in": "fade-in 180ms ease-out both",
        "fade-in-slow": "fade-in-slow 300ms ease-out both",
        "page-in": "fade-in-slow 1600ms cubic-bezier(0.22, 1, 0.36, 1) both",
        "overlay-in": "overlay-in 160ms ease-out both",
        "dialog-in": "dialog-in 180ms cubic-bezier(0.22, 1, 0.36, 1) both",
      },
    },
  },
  plugins: [],
};

export default config;
