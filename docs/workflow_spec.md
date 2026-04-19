# Workflow Specification

## Stages

1. Intake
2. Identity Verification
3. Insurance Review
4. Consent
5. Clinical Review
6. Triage
7. Ready for Scheduling

---

## Transitions

- Intake → Identity Verification
- Identity Verification → Insurance Review
- Insurance Review → Consent
- Consent → Clinical Review
- Clinical Review → Triage
- Triage → Ready

---

## Rules Per Stage

### Identity Verification
- ID must be verified

### Insurance Review
- Insurance must be verified

### Consent
- Consent form must be signed

---

## Permissions

- Admin: full access
- Reviewer: evaluate + verify documents
- Viewer: read-only

---

## Exceptions

- Manual override allowed (must log reason)
- Expired documents trigger re-evaluation
