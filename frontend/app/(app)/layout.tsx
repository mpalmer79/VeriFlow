import type { ReactNode } from "react";

import { AppShell } from "@/components/AppShell";
import { ToastProvider } from "@/components/ui/Toast";

export default function AuthedLayout({ children }: { children: ReactNode }) {
  return (
    <ToastProvider>
      <AppShell>{children}</AppShell>
    </ToastProvider>
  );
}
