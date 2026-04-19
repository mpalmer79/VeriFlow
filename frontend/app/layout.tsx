import type { Metadata } from "next";
import type { ReactNode } from "react";

import "./globals.css";

export const metadata: Metadata = {
  title: "VeriFlow",
  description:
    "Workflow intelligence platform for process compliance, operational risk, and explainable decisions.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-surface font-sans text-text antialiased">
        {children}
      </body>
    </html>
  );
}
