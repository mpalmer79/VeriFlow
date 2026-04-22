"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

import { readToken } from "@/lib/auth";
import { demoSignInAs, isDemoMode } from "@/lib/demo";
import { ApiError, records } from "@/lib/api";

export default function Enter() {
  return (
    <Suspense fallback={null}>
      <EnterInner />
    </Suspense>
  );
}

function EnterInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const auto = searchParams.get("auto");
  const isReviewerAuto = auto === "reviewer";

  const [failureMessage, setFailureMessage] = useState<string | null>(null);
  const [autoFailed, setAutoFailed] = useState(false);

  useEffect(() => {
    const existing = readToken();
    if (existing) {
      // Reviewer-auto always deep-links into a blocked record, even if
      // the browser already carries a demo session from a prior visit.
      if (isReviewerAuto) {
        let cancelled = false;
        void (async () => {
          try {
            const target = await findFirstBlockedRecordPath();
            if (!cancelled) router.replace(target);
          } catch {
            if (!cancelled) router.replace("/records");
          }
        })();
        return () => {
          cancelled = true;
        };
      }
      router.replace("/dashboard");
      return;
    }
    if (!isDemoMode()) {
      router.replace("/login");
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        if (isReviewerAuto) {
          await demoSignInAs("reviewer");
          const target = await findFirstBlockedRecordPath();
          if (!cancelled) router.replace(target);
          return;
        }
        await demoSignInAs("admin");
        if (!cancelled) router.replace("/dashboard");
      } catch (err) {
        if (cancelled) return;
        if (isReviewerAuto) {
          setAutoFailed(true);
          return;
        }
        setFailureMessage(
          err instanceof Error
            ? err.message
            : "Demo sign-in failed. Check that the backend is reachable.",
        );
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router, isReviewerAuto]);

  if (autoFailed) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4 py-10">
        <div className="w-full max-w-md rounded-md border border-severity-critical/40 bg-severity-critical/10 p-4 text-sm text-severity-critical">
          <div className="mb-1 text-xs font-medium uppercase tracking-wide">
            Demo auto-login failed.
          </div>
          <Link
            href="/enter"
            className="underline transition-colors hover:text-text"
          >
            Sign in manually
          </Link>
        </div>
      </div>
    );
  }

  if (failureMessage) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4 py-10">
        <div className="w-full max-w-md rounded-md border border-severity-critical/40 bg-severity-critical/10 p-4 text-sm text-severity-critical">
          <div className="mb-1 text-xs font-medium uppercase tracking-wide">
            Demo sign-in failed
          </div>
          <div>{failureMessage}</div>
        </div>
      </div>
    );
  }

  if (isReviewerAuto) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4 py-10">
        <div className="text-sm text-text-muted">Signing in to demo…</div>
      </div>
    );
  }

  return null;
}

async function findFirstBlockedRecordPath(): Promise<string> {
  try {
    const rows = await records.list({ limit: 100 });
    const blocked = rows.find((r) => r.status === "blocked");
    return blocked ? `/records/${blocked.id}` : "/records";
  } catch (err) {
    // 401 after a token save is transient — let the caller decide whether
    // to retry or fall back. Anything else propagates so the auto flow
    // surfaces an error rather than silently landing on the wrong page.
    if (err instanceof ApiError && err.status === 401) return "/records";
    throw err;
  }
}
