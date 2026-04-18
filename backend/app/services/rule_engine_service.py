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
from typing import Callable, Dict, List

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.enums import RuleActionApplied, RuleActionType
from app.models.record import Record
from app.models.rule import Rule


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


def evaluate_record(db: Session, record: Record) -> List[RuleResult]:
    """Run every active rule for the record's workflow and return all results."""
    rules = load_active_rules(db, record.workflow_id)
    results: List[RuleResult] = []
    for rule in rules:
        evaluator = get_evaluator(rule.code)
        results.append(evaluator(record, rule))
    return results


# Import built-in rule evaluators so they register on module import. Keep this
# at the bottom to avoid circular imports during registration.
from app.services import rules as _rules  # noqa: E402,F401
