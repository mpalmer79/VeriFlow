"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";

import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { Logomark } from "@/components/ui/Logomark";
import { UserMenu } from "@/components/UserMenu";
import { clearSession, readToken, readUser } from "@/lib/auth";
import { DEMO_ROLES, isDemoMode, demoSignInAs } from "@/lib/demo";
import type { UserPublic, UserRole } from "@/lib/types";
import { useToast } from "@/components/ui/Toast";

interface NavItem {
  href: string;
  label: string;
  adminOnly?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/records", label: "Records" },
  { href: "/operations", label: "Operations", adminOnly: true },
];

export function AppShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const toast = useToast();
  const [user, setUser] = useState<UserPublic | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [switchingRole, setSwitchingRole] = useState<UserRole | null>(null);
  const demo = isDemoMode();

  useEffect(() => {
    const token = readToken();
    if (!token) {
      router.replace(
        demo ? "/" : `/login?next=${encodeURIComponent(pathname || "/dashboard")}`,
      );
      return;
    }
    setUser(readUser());
    setHydrated(true);
  }, [router, pathname, demo]);

  if (!hydrated) {
    return (
      <div className="flex h-screen items-center justify-center text-sm text-text-muted">
        Loading…
      </div>
    );
  }

  function handleSignOut() {
    clearSession();
    router.replace(demo ? "/" : "/login");
  }

  async function handleSwitchRole(role: UserRole) {
    if (switchingRole) return;
    const entry = DEMO_ROLES.find((r) => r.role === role);
    if (!entry) return;
    setSwitchingRole(role);
    try {
      clearSession();
      const freshUser = await demoSignInAs(role);
      // demoSignInAs already persists the new session; just update the
      // shell's local copy so the menu reflects the new role.
      setUser(freshUser);
      toast.push({
        kind: "success",
        text: `Signed in as ${entry.label}.`,
      });
      router.replace("/dashboard");
    } catch (err) {
      toast.push({
        kind: "error",
        text:
          err instanceof Error
            ? err.message
            : "Role switch failed. Check that the backend is reachable.",
      });
    } finally {
      setSwitchingRole(null);
    }
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-surface-border bg-surface-panel">
        <div className="mx-auto flex h-14 max-w-7xl items-center gap-6 px-6">
          <Link
            href="/"
            aria-label="VeriFlow — back to landing"
            className="flex items-center gap-2 tracking-tight"
          >
            <Logomark className="text-brand-400" size={22} />
            <span className="font-display text-lg font-semibold text-text">
              VeriFlow
            </span>
          </Link>
          <nav className="flex items-center gap-1">
            {NAV_ITEMS.filter((item) => {
              if (item.adminOnly && user?.role !== "admin") return false;
              return true;
            }).map((item) => {
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
            <ThemeToggle variant="full" />
            {user ? (
              <UserMenu
                user={user}
                demo={demo}
                switchingRole={switchingRole}
                onSwitchRole={handleSwitchRole}
                onSignOut={handleSignOut}
              />
            ) : null}
          </div>
        </div>
      </header>
      <main
        key={pathname}
        className="mx-auto w-full max-w-7xl flex-1 px-6 py-8 animate-fade-in"
      >
        {children}
      </main>
    </div>
  );
}
