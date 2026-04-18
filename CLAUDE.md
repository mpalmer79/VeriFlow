Build Phase 0 and Phase 1 for a serious portfolio project named VeriFlow.

Project summary:
VeriFlow is a workflow intelligence platform that enforces process compliance, detects operational risk, and explains why a record is blocked, warned, or ready to proceed. The first domain scenario is a healthcare intake and compliance workflow. This is not an EHR, scheduling system, or CRM clone.

The system tracks records moving through controlled workflow stages. At each stage, rules evaluate the current state, determine whether progression is allowed, calculate risk, and produce clear, human-readable explanations.

Tech stack:
- Frontend: Next.js + TypeScript (scaffold only in this phase)
- Backend: FastAPI + Python
- Database: PostgreSQL
- ORM: SQLAlchemy
- Validation: Pydantic
- Auth: JWT-based authentication

Monorepo structure:
- /backend (FastAPI app)
- /frontend (Next.js app scaffold only)
- /docs (supporting documentation)
- ARCHITECTURE.md (root-level system design document)
- README.md

Scope for this phase:

1. Create the full monorepo structure with:
   - backend/
   - frontend/
   - docs/
   - ARCHITECTURE.md at root
   - README.md at root

2. Backend setup (FastAPI):
   - Clean architecture layout:
     app/
       api/routes/
       core/
       models/
       schemas/
       services/
       repositories/
       seed/
   - main.py entrypoint
   - database connection configuration
   - environment configuration

3. Define SQLAlchemy models for:
   - Organization
   - User
   - Workflow
   - WorkflowStage
   - Record
   - Document
   - Rule
   - RuleEvaluation
   - AuditLog

4. Define enums (as proper database-backed enums where appropriate):
   - user_role (admin, intake_coordinator, reviewer, manager)
   - record_status
   - insurance_status
   - consent_status
   - medical_history_status
   - document_status
   - risk_band (low, moderate, high, critical)
   - rule_action_type (warn, block)
   - rule_severity (warning, high, critical)

5. Implement authentication:
   - Password hashing (bcrypt or equivalent)
   - JWT token creation
   - Endpoints:
     POST /api/auth/login
     GET /api/auth/me
   - Role-aware user model

6. Implement Record APIs:
   - GET /api/records
   - POST /api/records
   - GET /api/records/{id}
   - PATCH /api/records/{id}
   - Records must include workflow linkage and stage tracking

7. Seed demo data:
   - One organization
   - Four users (admin, intake_coordinator, reviewer, manager)
   - One workflow named "Healthcare Intake"
   - Workflow stages in order:
     1. New Intake
     2. Identity Verification
     3. Insurance Review
     4. Consent & Authorization
     5. Clinical History Review
     6. Provider Triage
     7. Ready for Scheduling
     8. Blocked
     9. Closed
   - At least five demo records with varied states

8. Testing:
   - Create pytest-based tests for:
     - authentication success and failure
     - record creation
     - record retrieval
   - Tests must be runnable and pass

9. Documentation files:

   Create README.md with:
   - project overview
   - what VeriFlow does
   - example healthcare intake scenario
   - clear explanation that this is a workflow intelligence system, not a CRM

   Create docs/product_overview.md:
   - problem statement
   - solution approach
   - key capabilities

   Create docs/workflow_rules.md:
   - describe the workflow stages
   - outline initial rule concepts (no full engine yet)

10. Create a root-level ARCHITECTURE.md with the following sections:

   - Overview:
     High-level description of the system and purpose

   - System Components:
     Frontend (Next.js)
     Backend (FastAPI)
     Database (PostgreSQL)

   - Core Concepts:
     Records
     Workflows
     Rules
     Risk scoring
     Audit logging

   - Service Architecture:
     Describe responsibilities of:
       auth_service
       record_service
       workflow_service
       document_service
       rule_engine_service (planned)
       risk_service (planned)
       audit_service

   - Data Flow:
     Example flow:
       Record update → evaluation (future) → rule engine (future) → risk calculation → response → audit log

   - Key Design Decisions:
     - rules will be code-driven in early phases
     - generic record model used for cross-domain flexibility
     - healthcare is a demonstration scenario, not a full implementation

   - Future Extensions:
     - rule engine expansion
     - multi-domain support
     - external integrations

11. Frontend (minimal for this phase):
   - Initialize Next.js app with TypeScript
   - Basic folder structure
   - Placeholder pages:
     /login
     /dashboard
   - No full UI implementation yet

Constraints and quality requirements:

- Keep the system production-minded, not tutorial-level
- Keep naming consistent and intentional
- Avoid placeholder TODO spam
- Avoid fake features or mocked logic unless clearly marked
- Keep comments minimal and human-written
- Do not overengineer the rule engine yet
- Do not build a visual rule builder
- Do not introduce AI features in this phase
- Maintain clean separation of concerns between services
- Code should be readable, structured, and maintainable

Acceptance criteria:

- Backend runs successfully with seeded demo data
- Authentication works correctly
- Record CRUD endpoints function properly
- Tests execute and pass
- Repository structure is clean and professional
- README and ARCHITECTURE.md are complete and meaningful
