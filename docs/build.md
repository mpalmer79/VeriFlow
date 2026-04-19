Build Phase 4 for VeriFlow. This phase is the minimal but serious frontend demonstration layer for the existing backend system. Do not broaden scope beyond that. This work should result in a usable product walkthrough surface by the end of the run.

Project reminder:
VeriFlow is a workflow intelligence platform that enforces process compliance, detects operational risk, and explains why a record is blocked, warned, or ready to proceed. The first scenario is a healthcare intake and compliance workflow. This is not an EHR, scheduling system, or CRM clone.

Current repo status:
- Backend foundation, auth, records, workflows, rules, evaluations, risk scoring, transition enforcement, document evidence, document requirements, stage-aware rule filtering, and audit payloads already exist
- Backend is the strongest part of the project and must not be diluted by weak frontend decisions
- This phase exists to expose and demonstrate backend capabilities through a clean UI

Primary goal:
Build a focused frontend that showcases the system’s real value:
- workflow state
- document evidence
- evaluation outcomes
- blocking and warning logic
- risk scoring
- auditability

Do not build fake analytics, AI features, admin builders, or decorative UI.

1. Frontend scope

Build or complete the following pages only:
- /login
- /dashboard
- /records
- /records/[id]

Add only the minimal shared layout and auth plumbing needed to support those screens.

2. UX and design constraints

The UI must feel like a serious operational system, not a school project or flashy startup landing page.

Requirements:
- clean, modern, restrained design
- information-dense but readable
- strong hierarchy for important operational states
- consistent severity display for low, moderate, high, critical
- no emoji UI
- no decorative charts unless an existing backend endpoint naturally supports a simple one and it is clearly worth it
- no animations unless extremely light and justified
- avoid overdesign
- prioritize clarity, explainability, and usability

Use:
- Next.js with TypeScript
- existing frontend stack in the repo
- Tailwind and shadcn/ui components if already present or appropriate

3. Auth flow

Implement a working auth flow using the existing backend auth endpoints.

Requirements:
- login form submits to backend auth endpoint
- store token in a reasonable MVP-safe frontend pattern consistent with the current app
- protected pages redirect unauthenticated users to /login
- display useful auth error states
- provide logout action

Keep the auth implementation clean and minimal. Do not overengineer session management.

4. Shared layout and navigation

Build a minimal app shell for authenticated pages.

Should include:
- app header or sidebar
- navigation links to Dashboard and Records
- user context or simple logged-in state if easy
- logout action

Do not build a large navigation system.

5. Dashboard page

Build a practical dashboard that surfaces core operational information.

The page should show:
- total active records
- blocked records
- high-risk records
- records needing review if an appropriate backend field or endpoint supports it
- recent records and/or recent audit activity

If exact summary endpoints already exist, use them.
If not, derive the view from available APIs with minimal frontend logic.

Dashboard should not rely on charts to feel complete. Cards plus actionable lists are enough.

6. Records list page

Build a professional records table/list view.

Show columns such as:
- subject name
- current stage
- status
- risk score
- risk band
- assigned user
- updated at

Requirements:
- clickable rows into record detail
- basic search by subject name if feasible
- filters for stage and risk band if feasible
- blocked/high-risk states visually identifiable
- loading and empty states

Do not build complex pagination unless already needed by the current backend responses.

7. Record detail page

This is the most important page in the whole UI. It must clearly demonstrate the system’s intelligence and workflow enforcement.

Include:

Header:
- subject name
- current stage
- status
- risk score
- risk band
- assigned user if available

Sections:
- evaluation summary
- blocking issues
- warnings
- workflow stage timeline or ordered stage list with current stage clearly indicated
- document evidence panel
- document status summary
- audit trail

Actions:
- run evaluation
- attempt transition to next stage or selected allowed stage if supported cleanly
- verify document
- reject document

The page should make it obvious:
- why the record is blocked or not blocked
- which evidence exists
- what remains missing
- what changed over time

8. Document evidence UI

For each record, show:
- required document types
- present document types
- satisfied document types
- missing document types
- rejected document types

Also show document entries with fields like:
- document type
- status
- uploaded at
- verified at
- verifier
- rejection reason if present

Actions:
- verify document
- reject document

Use the existing backend document endpoints and status endpoint.
Do not build file upload integration beyond what the backend currently supports if storage is still metadata-driven.

9. Evaluation and transition UX

The record detail page should allow:
- manual evaluation trigger
- transition attempt

Requirements:
- show evaluation result payload clearly
- separate blocking violations from warnings
- show risk score and risk band updates
- show transition success/failure messages clearly
- refresh state correctly after evaluation or transition

Do not hide important details behind excessive accordions or modals.

10. Type safety and API integration

Create or refine:
- frontend/lib/api.ts
- frontend/lib/auth.ts
- frontend/lib/types.ts

Requirements:
- typed response handling for:
  - auth
  - record list
  - record detail
  - evaluation result
  - document status
  - audit entries
- avoid scattered fetch calls across components where a small API helper layer is more appropriate
- keep the abstraction thin and practical

11. Component structure

Create reusable but not overabstracted components such as:
- dashboard stat card
- risk badge
- stage badge
- violation list
- warning list
- document status panel
- audit timeline
- records table

Do not create a giant component architecture for its own sake.

12. Loading, error, and empty states

Every main page should handle:
- loading
- backend failure
- empty datasets

The record detail page especially must handle:
- missing record
- missing documents
- no audit entries
- no warnings
- no blocking issues

13. Minimal polish requirements

Before finishing:
- ensure spacing and typography are consistent
- ensure severity indicators are visually clear
- ensure tables/cards do not feel raw or unfinished
- remove placeholder text
- remove obvious scaffolding noise
- ensure the app can be navigated cleanly end-to-end

14. Do not broaden scope

Explicitly do not:
- add AI/copilot features
- add charts unless clearly justified and supported
- build admin workflow/rule editors
- build multi-industry modules
- redesign the backend architecture
- introduce state management libraries unless already necessary and justified
- chase pixel perfection at the expense of functionality

15. Testing and validation

At minimum:
- keep the existing backend tests passing
- ensure the frontend builds successfully
- fix TypeScript issues
- add lightweight frontend tests only if already supported and quick to do, but do not let that consume the phase

16. Documentation updates

Update README and any frontend-specific docs only as needed to reflect:
- available UI pages
- how to log in locally
- what the UI demonstrates

Do not turn docs into marketing copy.

17. Deliverables

At the end of this phase, provide:
- the implemented frontend pages
- any API helper/types additions
- any minimal backend contract adjustments if absolutely required
- brief summary of:
  - which pages were built
  - how auth is handled
  - what actions are supported on record detail
  - any known limitations left for future polish

Acceptance criteria:
- login works
- protected pages work
- dashboard is usable
- records list is usable
- record detail clearly demonstrates workflow, evidence, evaluation, risk, and auditability
- frontend build succeeds
- the UI feels like a serious operations product, not a toy

Assign multiple agents to work in parallel and not overlapping of each other
