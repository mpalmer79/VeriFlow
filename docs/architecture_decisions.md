# Architecture Decisions

## 1. Modular Monolith

### Decision
Use a modular monolith instead of microservices.

### Why
- Strong transactional integrity
- Easier rule consistency
- Faster iteration on workflow logic

### Tradeoff
- Reduced independent scaling

---

## 2. Code-Based Rule Engine

### Decision
Rules are implemented in code rather than external DSL.

### Why
- Maximum control
- Strong testability
- Explicit logic

### Future Path
- Introduce DMN-style decision tables once rules stabilize

---

## 3. Append-Only Audit Log

### Decision
All state transitions and evaluations produce audit events.

### Why
- Traceability
- Compliance readiness
- Debugging and replay capability

### Weakness (Current)
- Not yet tamper-evident

---

## 4. Stage-Based Workflow Model

### Decision
Explicit stage boundaries with controlled transitions.

### Why
- Prevent invalid progression
- Align with real-world process steps
- Enable rule scoping

---

## 5. Evidence-Centric Design

### Decision
Documents and verification states are first-class entities.

### Why
- Real-world workflows depend on documents
- Enables enforceable compliance
- Supports explainable decisions
