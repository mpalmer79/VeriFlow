"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useCallback, useEffect, useRef, useState } from "react";

import { Check, ChevronRight } from "@/components/icons";
// Home is not in the icon barrel yet. Importing direct from lucide-react
// instead of editing components/icons/index.ts keeps this PR to one file;
// followup can migrate it into the barrel.
import { Home } from "lucide-react";
import { DURATION_MICRO, EASE_OUT } from "@/lib/motion";
import { DEMO_ROLES } from "@/lib/demo";
import type { UserPublic, UserRole } from "@/lib/types";

interface UserMenuProps {
  user: UserPublic;
  demo: boolean;
  switchingRole: UserRole | null;
  onSwitchRole: (role: UserRole) => void;
  onSignOut: () => void;
}

export function UserMenu({
  user,
  demo,
  switchingRole,
  onSwitchRole,
  onSignOut,
}: UserMenuProps) {
  const reduce = useReducedMotion();
  const [open, setOpen] = useState(false);
  const [roleOpen, setRoleOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const close = useCallback(() => {
    setOpen(false);
    setRoleOpen(false);
  }, []);

  useEffect(() => {
    if (!open) {
      setRoleOpen(false);
      return;
    }

    function onMouseDown(e: MouseEvent) {
      const t = e.target as Node;
      if (menuRef.current?.contains(t) || buttonRef.current?.contains(t)) return;
      close();
    }

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        close();
        buttonRef.current?.focus();
      } else if (e.key === "Tab") {
        close();
      }
    }

    document.addEventListener("mousedown", onMouseDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, close]);

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Open user menu"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-md border border-transparent px-2 py-1 text-xs transition-colors hover:border-surface-border hover:bg-surface-muted focus:outline-none focus:ring-1 focus:ring-brand-400"
      >
        <div className="text-right">
          <div className="font-medium text-text">{user.full_name}</div>
          <div className="text-text-muted">{user.role}</div>
        </div>
        <ChevronRight
          size={14}
          className={`text-text-subtle transition-transform ${open ? "rotate-90" : ""}`}
          aria-hidden
        />
      </button>

      <AnimatePresence>
        {open ? (
          <motion.div
            ref={menuRef}
            role="menu"
            initial={reduce ? false : { opacity: 0, scale: 0.95, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={reduce ? undefined : { opacity: 0, scale: 0.95, y: -4 }}
            transition={
              reduce ? { duration: 0 } : { duration: DURATION_MICRO, ease: EASE_OUT }
            }
            className="absolute right-0 top-full z-20 mt-2 min-w-[13rem] origin-top-right overflow-hidden rounded-md border border-surface-border bg-surface-panel py-1 shadow-lg shadow-black/40"
          >
            {demo ? (
              <>
                <button
                  type="button"
                  role="menuitem"
                  aria-haspopup="menu"
                  aria-expanded={roleOpen}
                  onClick={() => setRoleOpen((v) => !v)}
                  className="flex w-full items-center justify-between gap-2 px-3 py-1.5 text-left text-xs text-text transition-colors hover:bg-surface-muted focus:bg-surface-muted focus:outline-none"
                >
                  <span>Switch role</span>
                  <ChevronRight
                    size={12}
                    className={`text-text-subtle transition-transform ${
                      roleOpen ? "rotate-90" : ""
                    }`}
                    aria-hidden
                  />
                </button>
                <AnimatePresence initial={false}>
                  {roleOpen ? (
                    <motion.ul
                      key="roles"
                      initial={reduce ? false : { opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={reduce ? undefined : { opacity: 0, height: 0 }}
                      transition={
                        reduce
                          ? { duration: 0 }
                          : { duration: DURATION_MICRO, ease: EASE_OUT }
                      }
                      className="overflow-hidden border-t border-surface-border bg-surface-muted/40"
                    >
                      {DEMO_ROLES.map((entry) => {
                        const isCurrent = entry.role === user.role;
                        const isSwitching = switchingRole === entry.role;
                        return (
                          <li key={entry.role}>
                            <button
                              type="button"
                              role="menuitem"
                              disabled={isCurrent || switchingRole !== null}
                              onClick={() => {
                                onSwitchRole(entry.role);
                                close();
                              }}
                              className="flex w-full items-center justify-between gap-2 px-4 py-1.5 text-left text-xs text-text transition-colors hover:bg-surface-muted focus:bg-surface-muted focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              <span>{entry.label}</span>
                              {isCurrent ? (
                                <Check
                                  size={12}
                                  className="text-verified"
                                  aria-hidden
                                />
                              ) : isSwitching ? (
                                <span className="text-text-subtle">…</span>
                              ) : null}
                            </button>
                          </li>
                        );
                      })}
                    </motion.ul>
                  ) : null}
                </AnimatePresence>
              </>
            ) : null}
            <a
              href="/"
              role="menuitem"
              onClick={close}
              className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-text no-underline transition-colors hover:bg-surface-muted focus:bg-surface-muted focus:outline-none"
            >
              <Home size={12} className="text-text-subtle" aria-hidden />
              <span>Back to landing</span>
            </a>
            <div className="my-1 border-t border-surface-border" />
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                onSignOut();
                close();
              }}
              className="flex w-full items-center px-3 py-1.5 text-left text-xs text-text transition-colors hover:bg-surface-muted focus:bg-surface-muted focus:outline-none"
            >
              Sign out
            </button>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
