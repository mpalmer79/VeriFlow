import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "VeriFlow",
  description:
    "Workflow intelligence platform for process compliance, risk detection, and explainable decisions.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          fontFamily:
            "system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif",
          background: "#0b1220",
          color: "#e6edf3",
          minHeight: "100vh",
        }}
      >
        {children}
      </body>
    </html>
  );
}
