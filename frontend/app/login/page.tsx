"use client";

import { FormEvent, Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { ApiError, auth } from "@/lib/api";
import { readToken, saveSession } from "@/lib/auth";
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
    <div className="flex min-h-screen items-center justify-center px-4 py-10">
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
          <div className="mb-2 flex items-center justify-between">
            <div className="field-label">Local demo access</div>
            <div className="text-[11px] text-text-subtle">
              Password: <span className="font-mono">{DEMO_PASSWORD}</span>
            </div>
          </div>
          <p className="mb-3 text-xs text-text-subtle">
            For local walkthroughs only. Click &quot;Use this&quot; to populate
            the email field.
          </p>
          <ul className="space-y-1.5">
            {DEMO_ACCOUNTS.map((account) => (
              <li
                key={account.email}
                className="flex items-center justify-between gap-2 text-sm"
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
                  Use this
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
