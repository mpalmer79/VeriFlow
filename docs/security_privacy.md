# Security and Privacy

## Identity Model
- JWT (current)
- Future: OIDC integration

## Authorization
- Role-based access control
- Organization-level isolation

## Data Protection
- Encryption at rest (planned)
- Encryption in transit (required)

## Logging
- Structured logs only
- No PII in logs

## Audit
- Append-only events
- Future: hash-linked audit chain

## Compliance Targets
- NIST controls baseline
- OWASP ASVS
- HIPAA (if PHI present)

## Risks
- Cross-tenant data leakage
- Unauthorized access
- Sensitive data exposure in logs

## Mitigations
- Centralized authorization layer
- Redaction policies
- Strict validation and testing
