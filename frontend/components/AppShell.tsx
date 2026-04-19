"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";

import { clearSession, readToken, readUser } from "@/lib/auth";
import type { UserPublic } from "@/lib/types";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/records", label: "Records" },
];

export function AppShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<UserPublic | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const token = readToken();
    if (!token) {
      router.replace(`/login?next=${encodeURIComponent(pathname || "/dashboard")}`);
      return;
    }
    setUser(readUser());
    setHydrated(true);
  }, [router, pathname]);

  if (!hydrated) {
    return (
      <div className="flex h-screen items-center justify-center text-sm text-text-muted">
        Loading…
      </div>
    );
  }

  function handleLogout() {
    clearSession();
    router.replace("/login");
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-surface-border bg-surface-panel">
        <div className="mx-auto flex h-14 max-w-7xl items-center gap-6 px-6">
          <Link
            href="/dashboard"
            className="flex items-center gap-2 text-base font-semibold tracking-tight"
          >
            <span className="inline-block h-2 w-2 rounded-full bg-accent" aria-hidden />
            VeriFlow
          </Link>
          <nav className="flex items-center gap-1">
            {NAV_ITEMS.map((item) => {
              const active =
                pathname === item.href || pathname?.startsWith(`${item.href}/`);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`rounded-md px-3 py-1.5 text-sm transition-colors ${
                    active
                      ? "bg-surface-muted text-text"
                      : "text-text-muted hover:text-text"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <div className="ml-auto flex items-center gap-3">
            {user ? (
              <div className="text-right text-xs">
                <div className="font-medium text-text">{user.full_name}</div>
                <div className="text-text-muted">{user.role}</div>
              </div>
            ) : null}
            <button type="button" className="btn-secondary" onClick={handleLogout}>
              Sign out
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-7xl flex-1 px-6 py-8">{children}</main>
    </div>
  );
}
