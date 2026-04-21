import type { Metadata } from "next";
import { Fraunces, Inter, JetBrains_Mono } from "next/font/google";
import type { ReactNode } from "react";

import { ThemeProvider } from "@/components/theme/ThemeProvider";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-sans",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-mono",
});

const fraunces = Fraunces({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-display",
  axes: ["opsz", "SOFT"],
});

// Runs before React hydrates so the first paint already has the right
// data-theme. Phase 6 default is "light" — the app's real default
// theme. Operators who prefer dark via the OS still get it via the
// prefers-color-scheme check; anyone else sees light.
const THEME_FLASH_SUPPRESSION = `(function(){try{var s=localStorage.getItem("veriflow.theme");var t=(s==="light"||s==="dark")?s:(window.matchMedia&&window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light");document.documentElement.dataset.theme=t;}catch(_e){document.documentElement.dataset.theme="light";}})();`;

export const metadata: Metadata = {
  title: "VeriFlow",
  description:
    "Workflow intelligence platform for process compliance, operational risk, and explainable decisions.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${jetbrainsMono.variable} ${fraunces.variable}`}
    >
      <head>
        <script
          dangerouslySetInnerHTML={{ __html: THEME_FLASH_SUPPRESSION }}
        />
      </head>
      <body className="min-h-screen bg-surface font-sans text-text antialiased">
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
