Perform a high-ROI polish pass for VeriFlow. This is not a new feature phase. Do not broaden scope. Focus on the small but important backend and frontend improvements that make the current system feel complete, coherent, and portfolio-ready.

Project reminder:
VeriFlow is a workflow intelligence platform that enforces process compliance, detects operational risk, and explains why a record is blocked, warned, or ready to proceed. The first scenario is a healthcare intake and compliance workflow. This is not an EHR, scheduling system, or CRM clone.

Current repo status:
- Backend architecture is strong
- Rule engine, risk scoring, transitions, document evidence, document requirements, stage-aware evaluation, and audit trail are implemented
- Frontend includes login, dashboard, records list, and record detail
- Frontend build succeeds and backend tests pass
- The system is now in the polish and presentation stage

This pass must focus on the following only.

1. Fix record assignee display quality

Current problem:
The frontend renders `assigned_user_id` as `User #{id}`, which feels unfinished.

Required improvement:
Make the assignee display human-readable in the API response and UI.

Preferred solution:
- include `assigned_user_name` in the record read/list payloads
- if clean, also include `created_by_user_name` where useful
- keep the payload light; do not introduce a large nested user object unless it is clearly better

Update:
- backend schemas
- record query/service logic
- frontend types and rendering

Acceptance criteria:
- records list shows a readable assignee name
- record detail shows a readable assignee name
- if no assignee exists, the UI handles it cleanly

2. Fix persisted evaluation display quality

Current problem:
On initial page load, persisted `RuleEvaluation` rows do not expose a rule code, so the frontend falls back to `rule#N`.

Required improvement:
Include a stable human-readable rule identifier in persisted evaluation responses.

Preferred solution:
- add `rule_code` to the relevant read schema and API response
- optionally add `rule_name` too if that can be done cleanly and without clutter

Update:
- backend schemas
- evaluation query/service logic
- frontend types and rendering

Acceptance criteria:
- record detail never needs to render `rule#N`
- persisted evaluations and fresh evaluation responses use consistent identifiers
- UI explanations feel coherent before and after clicking “Run evaluation”

3. Tighten severity and status presentation in the frontend

Current problem:
The core information is present, but visual consistency may still vary across pages.

Required improvement:
Standardize display components for:
- risk band
- record status
- workflow stage
- document status
- blocking violations
- warnings

Suggested approach:
- create or refine shared components such as:
  - RiskBadge
  - StatusBadge
  - StageBadge
  - SeverityPanel
  - EmptyState
- make sure the same labels, colors, and hierarchy are used across dashboard, records list, and record detail

Acceptance criteria:
- the same concept looks the same everywhere
- blocked/high-risk states are obvious without feeling noisy
- warning vs blocking states are easy to distinguish

4. Refine login helper presentation

Current problem:
The local demo access helper is useful, but it can easily feel toy-like if the tone or styling is off.

Required improvement:
Keep the seeded-account helper, but present it as a restrained local-demo convenience.

Requirements:
- label it clearly as local demo access
- avoid playful or casual styling
- keep it visually secondary to the main login form
- make sure it reads like a practical demo affordance, not a gimmick

Acceptance criteria:
- the helper remains useful
- it does not cheapen the product tone

5. Improve dashboard usefulness without expanding scope

Current problem:
The dashboard may be functionally correct but still feel generic if its lists are not clearly actionable.

Required improvement:
Review the dashboard composition and make sure the existing content feels operationally useful.

Do not add charts or new data domains.
Instead:
- improve wording
- improve ordering
- improve table/list labels
- surface risk and blocked states clearly
- ensure “needs attention” is genuinely useful
- avoid filler panels

Acceptance criteria:
- dashboard gives a quick sense of operational state
- the most urgent records are easy to identify
- the page feels practical, not decorative

6. Tighten record detail page wording and empty states

Required improvement:
Review the record detail page and improve:
- labels
- section headings
- repeated language
- empty states for:
  - no blocking issues
  - no warnings
  - no documents
  - no audit history
  - no evaluations yet

Goal:
The page should feel clear and intentional, not raw.

Acceptance criteria:
- copy is concise and professional
- empty states feel finished, not placeholder-like
- the page remains information-dense but readable

7. Update docs only where needed

Make targeted updates to:
- README.md
- frontend/README.md if present

Potential updates:
- note the assignee/rule-code response improvements
- improve local demo access wording
- add or tighten the UI walkthrough section if useful

Do not rewrite docs broadly. Keep this targeted.

8. Add tests where appropriate

Add or update tests only where they provide meaningful coverage for the backend response improvements.

Examples:
- record response includes assigned_user_name when available
- evaluation response includes rule_code
- API output remains stable for null assignee

Do not get pulled into a frontend test project. Keep this lightweight and high-value.

9. Do not broaden scope

Explicitly do not:
- add new major pages
- add charts
- add frontend testing frameworks
- add AI features
- redesign auth
- build admin editors
- expand domain support
- refactor unrelated code for style alone

Keep this pass small, focused, and high-value.

10. Deliverables

At the end of this task, provide:
- updated backend response schemas and logic
- updated frontend display components and pages
- any added tests
- brief summary of:
  - what was polished
  - how assignee names are now exposed
  - how rule codes are now exposed
  - any remaining presentation limitations before deployment/showcase

Acceptance criteria:
- assignee names are human-readable
- rule identifiers are human-readable everywhere
- frontend severity/status presentation is consistent
- login helper feels professional
- dashboard and record detail read like a real operations product
- build still succeeds
- backend tests still pass
