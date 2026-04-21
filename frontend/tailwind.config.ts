import type { Config } from "tailwindcss";

// Every surface / text / brand / status color resolves to a CSS var
// defined in `app/theme.css`. The `<alpha-value>` placeholder is
// Tailwind's way of preserving opacity modifiers like bg-brand-500/15
// against an rgb() channel value.
const cssVar = (name: string) => `rgb(var(${name}) / <alpha-value>)`;

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
          DEFAULT: cssVar("--color-bg"),
          panel: cssVar("--color-bg-elevated"),
          muted: cssVar("--color-surface-muted"),
          border: cssVar("--color-surface-border"),
          sunken: cssVar("--color-bg-sunken"),
        },
        text: {
          DEFAULT: cssVar("--color-text"),
          muted: cssVar("--color-text-muted"),
          subtle: cssVar("--color-text-subtle"),
        },
        accent: {
          DEFAULT: "#3b82f6",
          strong: "#2563eb",
          from: cssVar("--color-accent-from"),
          to: cssVar("--color-accent-to"),
        },
        brand: {
          50: cssVar("--color-brand-50"),
          100: cssVar("--color-brand-100"),
          200: cssVar("--color-brand-200"),
          300: cssVar("--color-brand-300"),
          400: cssVar("--color-brand-400"),
          500: cssVar("--color-brand-500"),
          600: cssVar("--color-brand-600"),
          700: cssVar("--color-brand-700"),
          800: cssVar("--color-brand-800"),
          900: cssVar("--color-brand-900"),
        },
        // Status palette — theme-aware, WCAG-targeted per theme.
        danger: {
          DEFAULT: cssVar("--color-danger"),
          bg: cssVar("--color-danger-bg"),
          border: cssVar("--color-danger-border"),
        },
        warning: {
          DEFAULT: cssVar("--color-warning"),
          bg: cssVar("--color-warning-bg"),
          border: cssVar("--color-warning-border"),
        },
        success: {
          DEFAULT: cssVar("--color-success"),
          bg: cssVar("--color-success-bg"),
          border: cssVar("--color-success-border"),
        },
        info: {
          DEFAULT: cssVar("--color-info"),
          bg: cssVar("--color-info-bg"),
          border: cssVar("--color-info-border"),
        },
        // severity / verified / rejected stay as fixed hex. The
        // domain semantics (risk band color scale, verify/reject
        // document status) carry meaning across themes; Phase 6 may
        // promote them to tokens, but it is not required here.
        severity: {
          low: "#22c55e",
          moderate: "#eab308",
          high: "#f97316",
          critical: "#ef4444",
        },
        verified: "#14b8a6",
        rejected: "#b45309",
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
        display: [
          "var(--font-display)",
          "ui-serif",
          "Georgia",
          "Cambria",
          "Times New Roman",
          "Times",
          "serif",
        ],
      },
      borderRadius: {
        sm: "var(--radius-sm)",
        DEFAULT: "var(--radius-md)",
        md: "var(--radius-md)",
        lg: "var(--radius-lg)",
        xl: "var(--radius-xl)",
      },
      boxShadow: {
        sm: "var(--shadow-sm)",
        DEFAULT: "var(--shadow-md)",
        md: "var(--shadow-md)",
        lg: "var(--shadow-lg)",
      },
      keyframes: {
        "chain-pulse": {
          "0%, 100%": { opacity: "0.85", transform: "scale(1)" },
          "50%": { opacity: "1", transform: "scale(1.15)" },
        },
      },
      animation: {
        "chain-pulse": "chain-pulse 3s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;
