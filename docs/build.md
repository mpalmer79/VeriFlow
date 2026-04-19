You are acting as a staff-level backend engineer performing Phase 1 hardening on an existing FastAPI + SQLAlchemy + PostgreSQL project named VeriFlow.

Your job is to implement the Phase 1 integrity upgrades carefully, completely, and with minimal collateral damage. Do not guess. Inspect the repository first, reconcile naming and structure with what actually exists, and then make the changes in the correct files. If file names, import paths, or model names differ from what is expected, adapt intelligently while preserving current architecture and conventions.

This is not a greenfield rewrite. This is a targeted hardening pass on an existing modular monolith.

==================================================
OBJECTIVE
==================================================

Implement the following Phase 1 upgrades:

1. Optimistic concurrency protection for records
2. Tamper-evident audit chaining
3. Stronger document integrity metadata
4. Stronger JWT claim structure and validation
5. API/schema updates required to support the above
6. Database migration support for the new columns if migration tooling already exists
7. If migration tooling does not exist, add the safest minimal bootstrap path and document it clearly

Do not stop at partial implementation. Ensure imports, schemas, routes, services, models, and persistence are all consistent.

==================================================
NON-NEGOTIABLE EXECUTION RULES
==================================================

1. Inspect the repo before editing anything.
   - Read the backend structure fully.
   - Identify actual paths for:
     - models
     - schemas
     - services
     - repositories
     - routes
     - auth/security
     - database/session config
     - migration tooling, if any
   - Confirm naming of record, document, audit, workflow, and user models.

2. Do not blindly create duplicate files.
   - Prefer modifying existing files.
   - Only add new files when necessary.

3. Preserve the existing architecture.
   - Keep the modular monolith approach.
   - Do not introduce microservices, event buses, Celery, Redis, or unrelated infrastructure.
   - Do not redesign the whole auth system.
   - Do not replace the rule engine.

4. Make the code production-minded.
   - Strong typing
   - Clean imports
   - No dead code
   - No placeholder comments
   - No AI-style verbose comments
   - Minimal natural comments only where necessary

5. Make the implementation internally consistent.
   - If a schema requires a field, ensure service and route layers support it.
   - If a model changes, ensure serialization still works.
   - If a token decoder changes, ensure auth dependency behavior still works.

6. Do not break existing behavior unless required for correctness.
   - If backward compatibility is feasible, preserve it.
   - If not feasible, update affected callers in the repo.

7. Add or update tests if the repo already has a test suite.
   - At minimum cover:
     - record version conflict
     - audit chain creation
     - token issuance/validation
     - document metadata persistence

8. At the end, provide:
   - a concise implementation summary
   - exact files changed
   - any migrations added
   - any follow-up risks or known limitations

Do not claim success unless the code is actually consistent.

==================================================
PHASE 1 REQUIREMENTS
==================================================

----------------------------------------
A. OPTIMISTIC CONCURRENCY FOR RECORDS
----------------------------------------

Goal:
Prevent silent last-write-wins corruption on records and stage transitions.

Required behavior:
- Add a version column to the primary record entity.
- Default version = 1.
- Every successful record update increments version.
- Every successful stage transition increments version.
- Record update requests must require expected_version.
- Transition requests must require expected_version.
- If expected_version does not match current persisted version, return a conflict error.

Implementation details:
- Add version column on the record model.
- Update record update schema to include expected_version.
- Update transition request schema to include expected_version.
- Update service layer to compare expected_version against persisted version before mutation.
- Raise a specific domain/service exception for version conflict.
- Route layer should map version conflict to HTTP 409.
- Ensure the returned record includes the new version.
- Do not implement pessimistic locking unless already idiomatic in repo.
- Keep this as optimistic concurrency only.

Edge cases:
- Missing expected_version should fail validation at schema layer.
- Current version must be returned in record read schema.
- Transition attempts that fail due to blocking rules should not increment version unless a persisted state mutation actually occurs.
- If evaluation persistence already occurs during transition attempts, preserve intended behavior, but do not accidentally increment record version on a blocked transition unless current code semantics require that.

----------------------------------------
B. TAMPER-EVIDENT AUDIT CHAINING
----------------------------------------

Goal:
Strengthen audit events so they are no longer merely append-only by convention.

Required behavior:
- Add previous_hash and entry_hash to audit log model.
- Each new audit event should compute entry_hash using a deterministic hash over:
  - previous_hash
  - action
  - entity_type
  - entity_id
  - organization_id
  - actor_user_id
  - record_id
  - canonicalized payload
- Canonicalization must be stable.
- Use SHA-256.
- previous_hash should be taken from the most recent audit event in the relevant scope.
- If no prior event exists in scope, previous_hash should be empty or null consistently.
- entry_hash must be stored on each audit row.
- entry_hash should be unique if practical within current design.

Scope:
- Use organization-scoped chaining unless the repo already has a stronger existing pattern.
- Do not invent a distributed/global ledger.
- Keep implementation simple and correct.

Implementation details:
- Update audit model.
- Update audit service or equivalent event writer.
- Ensure every audit event written through the central audit service now generates hashes.
- Use stable JSON serialization for payload canonicalization:
  - sort keys
  - compact separators
  - deterministic string conversion where necessary

Do not:
- add third-party blockchain libraries
- add signing infrastructure
- claim immutability
- change every caller manually if there is already a central audit helper

Preferred design:
- one central function handles audit persistence
- all routes/services continue using that helper

----------------------------------------
C. STRONGER DOCUMENT INTEGRITY METADATA
----------------------------------------

Goal:
Move documents closer to evidence objects rather than loose references.

Required new fields on the document model:
- original_filename
- mime_type
- size_bytes
- content_hash
- verified_content_hash
- expires_at

Interpretation:
- content_hash = hash captured at ingest or registration time
- verified_content_hash = hash observed/confirmed at verification time
- expires_at = optional evidence validity boundary

Requirements:
- Add fields to model.
- Add fields to read schema.
- Add fields to create/update schema only where appropriate.
- Preserve compatibility with current document registration flow if the system currently stores metadata without binary uploads.
- Do not force binary upload support in Phase 1 if the repo does not already support it.
- However, the data model must be ready for real evidence handling.

Behavior:
- Existing upload/register flow should still work.
- New metadata fields should be accepted and persisted if supplied.
- Verification logic should be able to record verified_content_hash when documents are verified, if such a verification function already exists.
- Do not invent a fake file-processing subsystem in this phase.

Constraints:
- If current routes only support logical document registration, extend them safely rather than redesigning into multipart upload.
- Avoid breaking existing clients.

----------------------------------------
D. STRONGER JWT CLAIMS AND VALIDATION
----------------------------------------

Goal:
Make token structure less fragile and closer to production practice without replacing current auth architecture.

Required issued claims:
- sub
- iat
- nbf
- exp
- iss
- aud
- typ
- jti

Required values:
- typ should be "access"
- iss should be app-specific and sourced from config when possible
- aud should be app-specific and sourced from config when possible
- jti should be a UUID string

Required validation behavior:
- token decode should validate:
  - signature
  - expiration
  - issuer
  - audience
- token type must be checked explicitly
- invalid token type should fail auth
- preserve current dependency injection pattern for current user resolution

Implementation details:
- Update token creation helper.
- Update token decode helper.
- Update auth dependency if required.
- Use existing config/settings module if present.
- If settings lack app_name or token audience/issuer config, add the smallest correct config extension.

Do not:
- replace JWT with sessions
- introduce refresh tokens
- add OAuth/OIDC login flow in this phase

----------------------------------------
E. ROUTE AND SCHEMA ALIGNMENT
----------------------------------------

You must ensure the API layer matches the model and service changes.

Required:
- Record read schema includes version
- Record update schema includes expected_version
- Transition request schema includes expected_version
- Transition response remains stable unless improvement is required
- Document read schema includes new metadata fields
- Document create/update schemas align with actual registration flow
- Route handlers map service exceptions to correct HTTP status codes

Preferred status mapping:
- not found -> 404
- bad workflow/stage mismatch or invalid domain action -> 400
- version conflict -> 409
- auth issues -> preserve existing pattern

----------------------------------------
F. PERSISTENCE / MIGRATIONS
----------------------------------------

You must inspect the repo and determine current persistence strategy.

Case 1: Alembic or another migration system already exists
- Add a proper migration for all new columns.
- Do not rely on metadata.create_all for production changes.
- Ensure downgrade exists if project conventions require it.

Case 2: No migration tooling exists
- Do not fake a full migration system unless it is practical and consistent with the repo.
- Add the model changes safely.
- If the app currently uses metadata.create_all at startup or seed time, preserve runtime behavior.
- Add a minimal migration/bootstrap note in docs or implementation summary stating that schema evolution is now required.
- If adding Alembic is low-risk and fits the repo, you may add it, but only if you can do it completely and correctly in one pass.
- Do not leave a half-configured migration system.

Priority:
Correctness over ambition.

----------------------------------------
G. TESTING
----------------------------------------

If tests exist, extend them.

Add or update tests for:
1. record update with matching expected_version succeeds and increments version
2. record update with stale expected_version fails with conflict
3. transition with stale expected_version fails with conflict
4. audit chain writes previous_hash and entry_hash consistently across two or more events
5. token create/decode enforces issuer, audience, and typ
6. document metadata persists and serializes

If the repo lacks tests in these areas:
- add focused tests in existing test style
- do not create a massive new testing framework

==================================================
IMPLEMENTATION DISCOVERY STEPS
==================================================

Before editing:
1. List backend directories and identify actual paths.
2. Open existing files for:
   - record model
   - document model
   - audit model
   - security/auth helper
   - record schemas
   - document schemas
   - evaluation/transition schemas
   - record service
   - workflow service
   - audit service/helper
   - records route
3. Determine whether repositories exist for data access and whether to update them.
4. Determine whether audit payload helper files exist and preserve them if possible.
5. Determine migration tooling status.
6. Determine test framework and current test layout.

Then implement changes.

==================================================
DESIGN GUIDANCE
==================================================

Use this logic unless the existing repo clearly requires a close variation:

1. Record version:
- integer
- starts at 1
- increments on successful mutation

2. Audit hash chain:
- canonical payload string via json.dumps(sort_keys=True, separators=(",", ":"), default=str)
- material concatenation in a stable order
- sha256 hex digest
- previous hash from latest audit row in scope

3. JWT:
- use existing jose/pyjwt library already in repo
- do not introduce unnecessary auth libraries

4. Exceptions:
- prefer existing service exception style if present
- otherwise add small, focused exception classes

5. Code style:
- no bash instructions
- no pseudo-code
- no placeholder TODOs
- no giant explanatory comments

==================================================
ACCEPTANCE CRITERIA
==================================================

Do not consider the task complete unless all of the following are true:

- record model has versioning support
- stale version updates fail safely
- stale version transitions fail safely
- audit logs store previous_hash and entry_hash
- audit events are chained by the central audit writer
- documents have stronger integrity metadata fields
- document schemas expose relevant metadata
- JWT creation includes iss/aud/typ/jti/nbf
- JWT decode validates issuer and audience
- routes and schemas compile consistently with services
- imports are clean
- no obvious runtime mismatch remains
- migration situation is handled appropriately for this repo
- tests are updated if the repo has tests

==================================================
OUTPUT FORMAT
==================================================

After implementation, provide:

1. Summary of what changed
2. Exact files modified
3. Exact files added
4. Migration files added, if any
5. Tests added or updated
6. Known limitations that remain after Phase 1

Do not stop after analysis. Perform the implementation.

Now begin by inspecting the repository structure and identifying the exact backend files that correspond to these concerns.
