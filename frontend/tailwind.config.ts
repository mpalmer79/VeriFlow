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
        brand: {
          50: "#edfafd",
          100: "#d2f1f6",
          200: "#aae1ec",
          300: "#75cadb",
          400: "#3dabc4",
          500: "#1c8da8",
          600: "#0e7490",
          700: "#0f5c78",
          800: "#134d63",
          900: "#12404f",
        },
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
