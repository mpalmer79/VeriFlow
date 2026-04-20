"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { readToken } from "@/lib/auth";
import { demoSignInAs, isDemoMode } from "@/lib/demo";

export default function Index() {
  const router = useRouter();
  const [failureMessage, setFailureMessage] = useState<string | null>(null);

  useEffect(() => {
    const existing = readToken();
    if (existing) {
      router.replace("/dashboard");
      return;
    }
    if (!isDemoMode()) {
      router.replace("/login");
      return;
    }
    // Demo deploys: auto-sign-in as admin and drop straight into the
    // dashboard. The `/roles` page is the supported way to switch to
    // other seeded roles afterwards.
    let cancelled = false;
    (async () => {
      try {
        await demoSignInAs("admin");
        if (!cancelled) router.replace("/dashboard");
      } catch (err) {
        if (!cancelled) {
          setFailureMessage(
            err instanceof Error
              ? err.message
              : "Demo sign-in failed. Check that the backend is reachable."
          );
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  return failureMessage ? (
    <div className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-md rounded-md border border-severity-critical/40 bg-severity-critical/10 p-4 text-sm text-severity-critical">
        <div className="mb-1 text-xs font-medium uppercase tracking-wide">
          Demo sign-in failed
        </div>
        <div>{failureMessage}</div>
      </div>
    </div>
  ) : null;
}
