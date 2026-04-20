"use client";

import { FormEvent, Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { ApiError, auth } from "@/lib/api";
import { readToken, saveSession } from "@/lib/auth";
import { isDemoMode } from "@/lib/demo";
import { ErrorBanner } from "@/components/ErrorBanner";

const DEMO_PASSWORD = "VeriFlow!2025";
const DEMO_ACCOUNTS: { email: string; role: string }[] = [
  { email: "admin@veriflow.demo", role: "Admin" },
  { email: "intake@veriflow.demo", role: "Intake coordinator" },
  { email: "reviewer@veriflow.demo", role: "Reviewer" },
  { email: "manager@veriflow.demo", role: "Manager" },
];

function resolveNext(raw: string | null): string {
  if (raw && raw.startsWith("/")) return raw;
  return "/dashboard";
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginPageInner />
    </Suspense>
  );
}

function LoginPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextParam = searchParams.get("next");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (readToken()) {
      router.replace(resolveNext(nextParam));
      return;
    }
    // Demo deployments never show the sign-in form; the root auto-
    // signs-in and directs to the dashboard, and `/roles` is the way
    // to swap roles from there.
    if (isDemoMode()) {
      router.replace("/");
    }
  }, [router, nextParam]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setErrorMessage(null);
    try {
      const token = await auth.login(email, password);
      if (typeof window !== "undefined") {
        window.localStorage.setItem("veriflow.token", token.access_token);
      }
      const user = await auth.me();
      saveSession(token.access_token, user);
      router.replace(resolveNext(nextParam));
    } catch (err: unknown) {
      if (err instanceof ApiError && err.detail && err.detail.trim().length > 0) {
        setErrorMessage(err.detail);
      } else {
        setErrorMessage(
          "Sign in failed. Please check your credentials and try again."
        );
      }
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10 animate-page-in">
      <div className="w-full max-w-[400px] space-y-4">
        <div className="panel p-6">
          <div className="mb-5 space-y-1">
            <div className="text-xs font-medium uppercase tracking-wide text-text-subtle">
              VeriFlow
            </div>
            <h1 className="text-lg font-semibold text-text">
              Sign in to continue
            </h1>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            <div className="space-y-1.5">
              <label htmlFor="email" className="field-label block">
                Email
              </label>
              <input
                id="email"
                type="email"
                required
                autoComplete="email"
                className="input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={submitting}
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="password" className="field-label block">
                Password
              </label>
              <input
                id="password"
                type="password"
                required
                autoComplete="current-password"
                className="input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={submitting}
              />
            </div>

            <button
              type="submit"
              className="btn-primary w-full"
              disabled={submitting}
            >
              {submitting ? "Signing in\u2026" : "Sign in"}
            </button>

            {errorMessage ? <ErrorBanner message={errorMessage} /> : null}
          </form>
        </div>

        <div className="panel-muted p-4">
          <div className="mb-1 field-label">Local demo access</div>
          <p className="mb-3 text-xs text-text-subtle">
            Seeded accounts, one per role. Available only when the backend
            has been seeded locally.
          </p>
          <ul className="divide-y divide-surface-border">
            {DEMO_ACCOUNTS.map((account) => (
              <li
                key={account.email}
                className="flex items-center justify-between gap-2 py-2 first:pt-0 last:pb-0 text-sm"
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate font-mono text-xs text-text">
                    {account.email}
                  </div>
                  <div className="text-[11px] text-text-subtle">
                    {account.role}
                  </div>
                </div>
                <button
                  type="button"
                  className="btn-secondary text-xs"
                  onClick={() => setEmail(account.email)}
                  disabled={submitting}
                >
                  Use email
                </button>
              </li>
            ))}
          </ul>
          <div className="mt-3 border-t border-surface-border pt-3 text-[11px] text-text-subtle">
            Shared demo password:{" "}
            <span className="font-mono text-text">{DEMO_PASSWORD}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
