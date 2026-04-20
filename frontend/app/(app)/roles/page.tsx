"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { EmptyState } from "@/components/EmptyState";
import { ErrorBanner } from "@/components/ErrorBanner";
import { Panel } from "@/components/Panel";
import { clearSession, readUser } from "@/lib/auth";
import { DEMO_ROLES, demoSignInAs, isDemoMode } from "@/lib/demo";
import type { UserRole } from "@/lib/types";


export default function RolesPage() {
  const router = useRouter();
  const [switching, setSwitching] = useState<UserRole | null>(null);
  const [error, setError] = useState<string | null>(null);
  const current = readUser();

  async function switchTo(role: UserRole): Promise<void> {
    if (switching) return;
    setSwitching(role);
    setError(null);
    try {
      clearSession();
      await demoSignInAs(role);
      router.replace("/dashboard");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Role switch failed. Check that the backend is reachable."
      );
      setSwitching(null);
    }
  }

  if (!isDemoMode()) {
    return (
      <div className="space-y-6">
        <header>
          <h1 className="text-xl font-semibold tracking-tight text-text">
            Roles
          </h1>
        </header>
        <EmptyState
          title="Role switcher not available"
          description="This surface is gated to demo deployments. On a production install, role is established by the signed-in user's account."
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-semibold tracking-tight text-text">
          Roles
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-text-muted">
          VeriFlow is role-aware. Each seeded account below has a different
          scope of what it can see and do; switching roles here signs the
          current browser session in as that account so you can walk through
          each view without separate credentials.
        </p>
      </header>

      {error ? <ErrorBanner message={error} /> : null}

      <Panel title="Signed in as">
        <div className="flex flex-wrap items-baseline gap-2 text-sm">
          {current ? (
            <>
              <span className="font-medium text-text">{current.full_name}</span>
              <span className="mono text-text-muted">{current.email}</span>
              <span className="chip border-accent/40 bg-accent/10 text-accent">
                {current.role}
              </span>
            </>
          ) : (
            <span className="text-text-muted">No active session.</span>
          )}
        </div>
      </Panel>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {DEMO_ROLES.map((entry) => {
          const isCurrent = current?.role === entry.role;
          const busy = switching === entry.role;
          return (
            <div
              key={entry.role}
              className="panel flex h-full flex-col gap-3 p-4"
            >
              <div className="flex items-baseline justify-between gap-2">
                <h2 className="text-sm font-semibold text-text">
                  {entry.label}
                </h2>
                <span className="mono text-xs text-text-muted">
                  {entry.email}
                </span>
              </div>
              <p className="text-sm text-text-muted">{entry.summary}</p>
              <div className="mt-auto flex items-center gap-2 pt-2">
                <button
                  type="button"
                  className={isCurrent ? "btn-secondary" : "btn-primary"}
                  onClick={() => void switchTo(entry.role)}
                  disabled={busy || isCurrent || switching !== null}
                >
                  {isCurrent
                    ? "Current role"
                    : busy
                      ? "Switching…"
                      : `Sign in as ${entry.label}`}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
