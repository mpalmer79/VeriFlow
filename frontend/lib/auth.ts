// Minimal client-side auth state.
// Tokens live in localStorage for this demo; this is MVP-safe for a local
// walkthrough but should be replaced with HTTP-only cookies before anything
// is hosted.

const TOKEN_KEY = "veriflow.token";
const USER_KEY = "veriflow.user";

import type { UserPublic } from "./types";

export function saveSession(token: string, user: UserPublic): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(TOKEN_KEY, token);
  window.localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function readToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(TOKEN_KEY);
}

export function readUser(): UserPublic | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as UserPublic;
  } catch {
    return null;
  }
}

export function clearSession(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(TOKEN_KEY);
  window.localStorage.removeItem(USER_KEY);
}

export function isAuthenticated(): boolean {
  return readToken() !== null;
}
