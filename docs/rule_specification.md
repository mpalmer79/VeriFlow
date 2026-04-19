# Rule Specification

## Rule Template

### Rule Name
Insurance Must Be Verified

### Stage
Insurance Review

### Business Intent
Ensure patient has valid and verified insurance before proceeding.

### Inputs
- insurance_status
- insurance_document

### Required Evidence
- Insurance Card (verified)

### Pass Condition
insurance_status == "verified"

### Fail Condition
insurance_status != "verified"

### Output
- block progression
- risk_score += 25

### Explanation Template
"Insurance is not verified. Verified insurance is required before proceeding."

### Owner
Compliance Team

### Tests
- Missing document → fail
- Unverified → fail
- Verified → pass
