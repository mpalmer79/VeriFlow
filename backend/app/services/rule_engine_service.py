"""Rule registry and evaluation entry point.

The engine is intentionally code-driven: each rule's logic lives in a
registered Python function. The database row (`Rule`) carries metadata
(code, workflow, stage, action, severity, risk weight, active flag) so
rules can be enabled, disabled, and audited independently of the code.

A rule evaluator receives the record being evaluated plus the `Rule` row
that activated it, and returns a `RuleResult` describing what happened.
The evaluator itself does not decide whether a failure warns or blocks;
that is carried on the rule row and translated by the helper below so the
same evaluator could be reused with different severities across workflows.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Callable, Dict, List, Optional

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.enums import RuleActionApplied, RuleActionType
from app.models.record import Record
from app.models.rule import Rule
from app.models.workflow import WorkflowStage


@dataclass(frozen=True)
class RuleResult:
    rule_code: str
    passed: bool
    action_applied: RuleActionApplied
    message: str
    risk_applied: int


Evaluator = Callable[[Record, Rule], RuleResult]

_REGISTRY: Dict[str, Evaluator] = {}


class RuleEngineError(Exception):
    pass


class UnknownRuleCode(RuleEngineError):
    """Raised when the database references a rule code without a registered evaluator."""


def register(code: str) -> Callable[[Evaluator], Evaluator]:
    """Register an evaluator under a rule code."""

    def decorator(fn: Evaluator) -> Evaluator:
        if code in _REGISTRY:
            raise RuleEngineError(f"Rule code already registered: {code}")
        _REGISTRY[code] = fn
        return fn

    return decorator


def get_evaluator(code: str) -> Evaluator:
    evaluator = _REGISTRY.get(code)
    if evaluator is None:
        raise UnknownRuleCode(f"No evaluator registered for rule code {code!r}")
    return evaluator


def registered_codes() -> List[str]:
    return sorted(_REGISTRY.keys())


def apply(rule: Rule, *, passed: bool, message: str) -> RuleResult:
    """Helper for evaluators: translate pass/fail into a full RuleResult.

    On failure, the applied action and risk follow the rule row so the same
    evaluator can be reused across workflows with different severities.
    """
    if passed:
        return RuleResult(
            rule_code=rule.code,
            passed=True,
            action_applied=RuleActionApplied.NONE,
            message=message,
            risk_applied=0,
        )

    action = (
        RuleActionApplied.BLOCK
        if rule.action == RuleActionType.BLOCK
        else RuleActionApplied.WARN
    )
    return RuleResult(
        rule_code=rule.code,
        passed=False,
        action_applied=action,
        message=message,
        risk_applied=rule.risk_weight,
    )


def load_active_rules(db: Session, workflow_id: int) -> List[Rule]:
    stmt = (
        select(Rule)
        .where(Rule.workflow_id == workflow_id, Rule.is_active.is_(True))
        .order_by(Rule.id.asc())
    )
    return list(db.execute(stmt).scalars().all())


def applicable_rules(
    rules: List[Rule],
    stage_context: Optional[WorkflowStage],
    stages_by_id: Dict[int, WorkflowStage],
) -> List[Rule]:
    """Filter rules to those that apply at the given stage context.

    Policy:
      - rules with `stage_id` = null are workflow-global and always apply
      - rules with a stage apply when that stage is at or before the
        stage context (by `order_index`); i.e. a stage-gated rule is in
        scope once the record has reached that stage's "exit gate"
      - if no stage context is given (None), every active rule applies

    The context is the current stage for plain evaluation and the target
    stage during a transition, so a transition to a later stage pulls in
    every rule up to and including the target.
    """
    if stage_context is None:
        return rules
    ctx_order = stage_context.order_index
    out: List[Rule] = []
    for rule in rules:
        if rule.stage_id is None:
            out.append(rule)
            continue
        stage = stages_by_id.get(rule.stage_id)
        if stage is not None and stage.order_index <= ctx_order:
            out.append(rule)
    return out


def evaluate_record(
    db: Session,
    record: Record,
    *,
    stage_context: Optional[WorkflowStage] = None,
) -> List[RuleResult]:
    """Run active rules applicable at `stage_context` and return all results.

    `stage_context` defaults to the record's current stage. Pass the target
    stage explicitly during a transition to evaluate against the stage the
    record is attempting to enter.
    """
    if stage_context is None:
        stage_context = record.current_stage

    rules = load_active_rules(db, record.workflow_id)
    stages_by_id = {stage.id: stage for stage in record.workflow.stages}
    applicable = applicable_rules(rules, stage_context, stages_by_id)

    results: List[RuleResult] = []
    for rule in applicable:
        evaluator = get_evaluator(rule.code)
        results.append(evaluator(record, rule))
    return results


# Import built-in rule evaluators so they register on module import. Keep this
# at the bottom to avoid circular imports during registration.
from app.services import rules as _rules  # noqa: E402,F401
