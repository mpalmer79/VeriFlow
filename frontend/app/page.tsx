"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, useReducedMotion } from "framer-motion";
import { useState, type MouseEvent } from "react";

import { ChainHero3D } from "@/components/landing/ChainHero3D";
import { ChainMotif } from "@/components/landing/ChainMotif";
import { RiskBadge } from "@/components/RiskBadge";
import { SeverityPanel } from "@/components/SeverityPanel";
import { WorkflowTimelineBody } from "@/components/record-detail/WorkflowTimeline";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { Logomark } from "@/components/ui/Logomark";
import {
  ArrowRight,
  ChevronRight,
  Fingerprint,
  Link2,
  ShieldCheck,
  type LucideIcon,
} from "@/components/icons";
// Brand glyphs not in the icon barrel yet — direct lucide-react import
// keeps this change to one file. A followup can migrate them.
import { Github, Linkedin } from "lucide-react";
import type { WorkflowStage } from "@/lib/types";
import {
  fadeRise,
  fadeRiseSlow,
  staggerParent,
  SPRING_DEFAULT,
} from "@/lib/motion";

const PILLARS: Array<{ icon: LucideIcon; title: string; body: string }> = [
  {
    icon: ShieldCheck,
    title: "Controlled transitions",
    body: "Stage progression is gated by a rule registry. Failing rules block the move or warn with explicit risk weight.",
  },
  {
    icon: Link2,
    title: "Tamper-evident audit",
    body: "Every domain event writes an append-only row whose hash chains to the one before it. Break a link and the verify endpoint says so.",
  },
  {
    icon: Fingerprint,
    title: "Verifiable evidence",
    body: "Uploads stream to managed storage with SHA-256 at ingest and re-hash at verification. Rewrite the bytes, lose the match.",
  },
];

const MOCK_VIOLATIONS = [
  {
    rule_code: "insurance.status_known",
    message:
      "Insurance status is unknown. Verified coverage, pending claim, or self-pay acknowledgement required.",
    risk_applied: 20,
  },
];

const MOCK_WARNINGS = [
  {
    rule_code: "consent.current",
    message: "Consent forms are older than 90 days. Re-sign before provider triage.",
    risk_applied: 10,
  },
  {
    rule_code: "documents.identity_evidence",
    message: "Identity document uploaded but not yet verified.",
    risk_applied: 5,
  },
];

const HEALTHCARE_STAGES: WorkflowStage[] = [
  { id: 1, name: "New intake", slug: "new_intake", order_index: 0, is_terminal: false },
  { id: 2, name: "Identity verification", slug: "identity_verification", order_index: 1, is_terminal: false },
  { id: 3, name: "Insurance review", slug: "insurance_review", order_index: 2, is_terminal: false },
  { id: 4, name: "Consent & authorization", slug: "consent", order_index: 3, is_terminal: false },
  { id: 5, name: "Clinical history", slug: "clinical_history", order_index: 4, is_terminal: false },
  { id: 6, name: "Provider triage", slug: "provider_triage", order_index: 5, is_terminal: false },
  { id: 7, name: "Ready", slug: "ready", order_index: 6, is_terminal: false },
  { id: 8, name: "Blocked", slug: "blocked", order_index: 7, is_terminal: true },
  { id: 9, name: "Closed", slug: "closed", order_index: 8, is_terminal: true },
];
const LANDING_CURRENT_STAGE = 3;

export default function Landing() {
  const router = useRouter();
  const reduce = useReducedMotion();

  function handleAnchorClick(e: MouseEvent<HTMLAnchorElement>, targetId: string) {
    const target = typeof document !== "undefined" ? document.getElementById(targetId) : null;
    if (!target) return;
    e.preventDefault();
    target.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
  }

  return (
    <main className="min-h-screen bg-surface text-text">
      <HeroSection onAnchorClick={handleAnchorClick} />
      <PillarsSection />
      <ExplainabilitySection />
      <HealthcareSection />
      <LandingFooter />
    </main>
  );
}

function HeroSection({
  onAnchorClick,
}: {
  onAnchorClick: (e: MouseEvent<HTMLAnchorElement>, id: string) => void;
}) {
  return (
    <section
      id="hero"
      aria-labelledby="hero-heading"
      className="textured bg-gradient-hero relative overflow-hidden"
    >
      <div className="absolute right-6 top-6 z-20">
        <ThemeToggle variant="full" />
      </div>
      <div className="relative mx-auto flex min-h-[92vh] max-w-6xl flex-col items-center justify-center px-6 py-24 text-center">
        <ChainHero3D
          className="absolute left-1/2 top-16 w-[92vw] -translate-x-1/2 md:w-[720px] lg:w-[960px] xl:w-[1120px]"
        />
        <ChainMotif
          className="pointer-events-none absolute bottom-24 left-[-6rem] hidden text-brand-700 opacity-30 md:block"
        />
        <motion.div
          variants={staggerParent}
          initial="hidden"
          animate="visible"
          className="relative z-10 flex flex-col items-center"
        >
          <motion.div
            variants={fadeRise}
            transition={SPRING_DEFAULT}
            className="flex items-center gap-3"
          >
            <Logomark className="text-brand-400" size={44} />
            <span className="font-display text-2xl font-semibold tracking-tight text-text sm:text-3xl">
              VeriFlow
            </span>
          </motion.div>
          <motion.h1
            id="hero-heading"
            variants={fadeRise}
            transition={SPRING_DEFAULT}
            className="mt-8 font-display text-4xl font-semibold leading-[1.05] tracking-tight text-text sm:text-6xl"
          >
            Process compliance
            <br />
            <span className="text-brand-700">you can prove.</span>
          </motion.h1>
          <motion.p
            variants={fadeRise}
            transition={SPRING_DEFAULT}
            className="mt-6 max-w-2xl text-base text-text-muted sm:text-lg"
          >
            VeriFlow enforces staged progression against a rule registry,
            scores operational risk, and produces an audit trail that a
            reviewer can verify — not just read.
          </motion.p>
          <motion.div
            variants={fadeRise}
            transition={SPRING_DEFAULT}
            className="mt-10 flex flex-col items-center gap-3 sm:flex-row"
          >
            <motion.div whileHover={{ y: -1 }} whileTap={{ y: 1 }}>
              <Link
                href="/enter?auto=admin"
                className="bg-gradient-cta inline-flex items-center gap-2 rounded-md px-5 py-2.5 text-sm font-semibold text-white transition-colors focus:outline-none focus:ring-2 focus:ring-brand-300"
              >
                Enter demo
                <ArrowRight size={16} aria-hidden />
              </Link>
            </motion.div>
            <a
              href="#pillars"
              onClick={(e) => onAnchorClick(e, "pillars")}
              className="inline-flex items-center gap-1.5 rounded-md border border-surface-border bg-surface-panel/60 px-5 py-2.5 text-sm font-medium text-text transition-colors hover:border-text-subtle"
            >
              See how it works
              <ChevronRight size={16} aria-hidden />
            </a>
            <a
              href="/design-system"
              className="inline-flex items-center gap-1.5 rounded-md border border-surface-border bg-surface-panel/60 px-5 py-2.5 text-sm font-medium text-text transition-colors hover:border-text-subtle"
            >
              View design system
              <ChevronRight size={16} aria-hidden />
            </a>
          </motion.div>
          <motion.div
            variants={fadeRise}
            transition={SPRING_DEFAULT}
            className="mt-12 flex items-center justify-center gap-3"
          >
            <a
              href="https://github.com/mpalmer79/VeriFlow"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="View the VeriFlow project on GitHub (opens in a new tab)"
              className="inline-flex items-center gap-2 rounded-full border border-surface-border bg-surface-panel/70 px-4 py-2 text-xs font-medium text-text-muted transition-colors hover:border-text-subtle hover:text-text focus:outline-none focus:ring-2 focus:ring-brand-300"
            >
              <Github size={14} aria-hidden />
              <span>GitHub</span>
            </a>
            <a
              href="https://www.linkedin.com/in/mpalmer1234/"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Visit Michael Palmer on LinkedIn (opens in a new tab)"
              className="inline-flex items-center gap-2 rounded-full border border-surface-border bg-surface-panel/70 px-4 py-2 text-xs font-medium text-text-muted transition-colors hover:border-text-subtle hover:text-text focus:outline-none focus:ring-2 focus:ring-brand-300"
            >
              <Linkedin size={14} aria-hidden />
              <span>LinkedIn</span>
            </a>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}

function PillarsSection() {
  return (
    <motion.section
      id="pillars"
      aria-labelledby="pillars-heading"
      variants={fadeRiseSlow}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: "-10%" }}
      transition={SPRING_DEFAULT}
      className="border-t border-surface-border"
    >
      <div className="mx-auto max-w-6xl px-6 py-24">
        <h2
          id="pillars-heading"
          className="font-display text-3xl font-semibold tracking-tight sm:text-4xl"
        >
          What it actually does.
        </h2>
        <p className="mt-3 max-w-2xl text-base text-text-muted">
          Three primitives, each pulling its own weight. None of them depend on
          the domain — healthcare intake is a scenario, not the product.
        </p>
        <motion.ul
          variants={staggerParent}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-10%" }}
          className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-3"
        >
          {PILLARS.map(({ icon: Icon, title, body }) => (
            <motion.li
              key={title}
              variants={fadeRise}
              transition={SPRING_DEFAULT}
              className="panel p-6"
            >
              <Icon size={28} className="text-brand-400" aria-hidden />
              <h3 className="mt-4 font-display text-xl font-semibold">
                {title}
              </h3>
              <p className="mt-2 text-sm text-text-muted">{body}</p>
            </motion.li>
          ))}
        </motion.ul>
      </div>
    </motion.section>
  );
}

function ExplainabilitySection() {
  return (
    <motion.section
      id="explainability"
      aria-labelledby="explain-heading"
      variants={fadeRiseSlow}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: "-10%" }}
      transition={SPRING_DEFAULT}
      className="border-t border-surface-border bg-surface-panel/30"
    >
      <div className="mx-auto grid max-w-6xl grid-cols-1 gap-12 px-6 py-24 lg:grid-cols-2 lg:items-center">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-400">
            Explainability
          </div>
          <h2
            id="explain-heading"
            className="mt-3 font-display text-3xl font-semibold tracking-tight sm:text-4xl"
          >
            Why is this record blocked?
          </h2>
          <p className="mt-4 max-w-xl text-base text-text-muted">
            Every evaluation returns the rules that ran, the ones that failed,
            the risk each one contributed, and the human-readable reason — so
            a reviewer can trust the decision without reading the source.
          </p>
        </div>
        <div className="space-y-4 rounded-lg border border-surface-border bg-surface-panel p-5 shadow-xl shadow-black/30">
          <div className="flex items-center justify-between gap-4 border-b border-surface-border pb-4">
            <div>
              <div className="field-label">Current stage</div>
              <div className="mt-1 font-display text-lg font-semibold">
                Insurance review
              </div>
            </div>
            <RiskBadge band="high" score={45} size="md" />
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <SeverityPanel
              tone="critical"
              title="Blocking issues"
              emptyLabel="No blocking issues."
              issues={MOCK_VIOLATIONS}
            />
            <SeverityPanel
              tone="warning"
              title="Warnings"
              emptyLabel="No active warnings."
              issues={MOCK_WARNINGS}
            />
          </div>
          <p className="text-xs text-text-subtle">
            Live component — same SeverityPanel rendered on every record
            detail page.
          </p>
        </div>
      </div>
    </motion.section>
  );
}

function HealthcareSection() {
  return (
    <motion.section
      id="healthcare"
      aria-labelledby="healthcare-heading"
      variants={fadeRiseSlow}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: "-10%" }}
      transition={SPRING_DEFAULT}
      className="border-t border-surface-border"
    >
      <div className="mx-auto max-w-6xl px-6 py-24">
        <h2
          id="healthcare-heading"
          className="font-display text-3xl font-semibold tracking-tight sm:text-4xl"
        >
          Healthcare intake is a scenario, not the product.
        </h2>
        <p className="mt-3 max-w-2xl text-base text-text-muted">
          The reference workflow moves prospective patients through nine
          stages. Swap it for loan intake, vendor onboarding, or claims
          triage and the engine does not know the difference.
        </p>
        <div className="mt-12 rounded-lg border border-surface-border bg-surface-panel/50 p-5">
          <WorkflowTimelineBody
            stages={HEALTHCARE_STAGES}
            currentStageId={LANDING_CURRENT_STAGE}
          />
        </div>
      </div>
    </motion.section>
  );
}

function LandingFooter() {
  return (
    <footer
      aria-label="Site"
      className="border-t border-surface-border bg-surface-panel/40"
    >
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-10 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-2 text-sm text-text-muted">
          <Logomark className="text-brand-400" size={18} />
          <span>© {new Date().getFullYear()} VeriFlow</span>
        </div>
        <nav aria-label="Resources" className="flex flex-wrap gap-6 text-sm text-text-muted">
          <a
            href="https://github.com/mpalmer79/veriflow"
            className="transition-colors hover:text-text"
            target="_blank"
            rel="noopener noreferrer"
          >
            GitHub
          </a>
          <a
            href="https://github.com/mpalmer79/veriflow/blob/main/ARCHITECTURE.md"
            className="transition-colors hover:text-text"
            target="_blank"
            rel="noopener noreferrer"
          >
            Architecture
          </a>
          <a
            href="https://github.com/mpalmer79/veriflow/tree/main/docs"
            className="transition-colors hover:text-text"
            target="_blank"
            rel="noopener noreferrer"
          >
            Docs
          </a>
        </nav>
        <div className="flex flex-col gap-1 text-xs text-text-subtle md:items-end">
          <div>
            Built by{" "}
            <a
              href="LINKEDIN_URL"
              className="transition-colors hover:text-text"
              target="_blank"
              rel="noopener noreferrer"
            >
              Michael Palmer
            </a>
            {" · "}
            <a
              href="GITHUB_PROFILE_URL"
              className="transition-colors hover:text-text"
              target="_blank"
              rel="noopener noreferrer"
            >
              GitHub
            </a>
          </div>
          <div>Built with FastAPI and Next.js.</div>
        </div>
      </div>
    </footer>
  );
}
