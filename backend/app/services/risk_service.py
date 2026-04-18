"""Risk scoring for evaluated records.

Pure functions that aggregate `RuleResult` risk contributions into a
total score and a coarse `RiskBand`. Banding thresholds are centralized
here so they can evolve without touching the evaluator or the persistence
layer.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Iterable, List

from app.models.enums import RiskBand
from app.services.rule_engine_service import RuleResult


# Ordered from lowest band upward. Each tuple is (inclusive_minimum, band).
_BAND_THRESHOLDS = (
    (80, RiskBand.CRITICAL),
    (50, RiskBand.HIGH),
    (25, RiskBand.MODERATE),
    (0, RiskBand.LOW),
)


@dataclass(frozen=True)
class RiskSummary:
    total_score: int
    risk_band: RiskBand
    summary: str


def _band_for_score(score: int) -> RiskBand:
    for threshold, band in _BAND_THRESHOLDS:
        if score >= threshold:
            return band
    return RiskBand.LOW


def compute(results: Iterable[RuleResult]) -> RiskSummary:
    triggered: List[RuleResult] = [r for r in results if not r.passed]
    total = sum(r.risk_applied for r in triggered)
    band = _band_for_score(total)

    if not triggered:
        summary = "No rules triggered."
    else:
        parts = sorted(
            (f"{r.rule_code} (+{r.risk_applied})" for r in triggered if r.risk_applied),
            key=str,
        )
        summary = (
            f"{len(triggered)} rule(s) triggered, risk {total} ({band.value}): "
            + ", ".join(parts)
            if parts
            else f"{len(triggered)} rule(s) triggered, risk {total} ({band.value})"
        )
    return RiskSummary(total_score=total, risk_band=band, summary=summary)
