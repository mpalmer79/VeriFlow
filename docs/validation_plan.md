# Validation Plan

## Unit Tests
- Rule logic
- Risk scoring
- Edge cases

## Integration Tests
- Stage transitions
- Document lifecycle
- Audit event generation

## Negative Tests
- Missing documents
- Invalid transitions
- Unauthorized access

## Security Tests
- Tenant isolation
- Role enforcement
- Token validation

## Audit Validation
- Every action produces event
- No missing links in chain

## Adversarial Tests
- Wrong document attached
- Expired evidence
- Replay attacks

## Acceptance Criteria
- No invalid transitions possible
- All decisions explainable
- Full audit trace available
