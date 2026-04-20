// Demo-mode helpers.
//
// When `NEXT_PUBLIC_DEMO_MODE` is truthy at build time, the deployed
// site auto-signs-in as the admin demo account on first visit and
// exposes a role picker at `/roles`. This is meant for public
// portfolio deployments; production installations leave the flag
// unset and the normal sign-in flow remains the only path.

import type { UserPublic, UserRole } from "./types";
import { auth } from "./api";
import { saveSession } from "./auth";

const DEMO_PASSWORD = "VeriFlow!2025";

export const DEMO_ROLES: ReadonlyArray<{
  role: UserRole;
  email: string;
  label: string;
  summary: string;
}> = [
  {
    role: "admin",
    email: "admin@veriflow.demo",
    label: "Admin",
    summary:
      "Full access to audit-chain verification, storage inventory, and orphan cleanup under the operations console.",
  },
  {
    role: "intake_coordinator",
    email: "intake@veriflow.demo",
    label: "Intake coordinator",
    summary:
      "Creates records, uploads evidence, and moves records through the early intake stages.",
  },
  {
    role: "reviewer",
    email: "reviewer@veriflow.demo",
    label: "Reviewer",
    summary:
      "Verifies document evidence, runs integrity checks, and rejects documents with a reason.",
  },
  {
    role: "manager",
    email: "manager@veriflow.demo",
    label: "Manager",
    summary:
      "Oversees the workflow, reassigns records, and reviews evaluation + audit trails without unrestricted admin powers.",
  },
];

export function isDemoMode(): boolean {
  const raw =
    typeof process !== "undefined"
      ? process.env.NEXT_PUBLIC_DEMO_MODE
      : undefined;
  if (!raw) return false;
  const normalised = String(raw).trim().toLowerCase();
  return ["1", "true", "yes", "on"].includes(normalised);
}

export async function demoSignInAs(role: UserRole): Promise<UserPublic> {
  const entry = DEMO_ROLES.find((r) => r.role === role);
  if (!entry) {
    throw new Error(`Unknown demo role: ${role}`);
  }
  const token = await auth.login(entry.email, DEMO_PASSWORD);
  if (typeof window !== "undefined") {
    window.localStorage.setItem("veriflow.token", token.access_token);
  }
  const user = await auth.me();
  saveSession(token.access_token, user);
  return user;
}
