"""Phase 8F — stages with live rules cannot be cascade-deleted.

The WorkflowStage.rules relationship moved from all,delete-orphan to
all,save-update so deleting a stage no longer silently evicts its
rules. `workflow_service.delete_stage` is the intended entry point
and must refuse when rules are still attached.
"""

from __future__ import annotations

import pytest
from sqlalchemy import select

from app.models.enums import RuleActionType, RuleSeverity
from app.models.rule import Rule
from app.models.workflow import Workflow, WorkflowStage
from app.services import workflow_service


def _fresh_workflow(db_session) -> Workflow:
    primary = db_session.execute(
        select(Workflow).where(Workflow.slug == "healthcare-intake")
    ).scalar_one()
    workflow = Workflow(
        organization_id=primary.organization_id,
        name="Deletion Test Flow",
        slug="deletion-test-flow",
        description="Used only by the stage-deletion refusal test.",
    )
    db_session.add(workflow)
    db_session.flush()
    stage = WorkflowStage(
        workflow_id=workflow.id,
        name="With Rules",
        slug="with-rules",
        order_index=0,
        is_terminal=False,
    )
    db_session.add(stage)
    db_session.flush()
    return workflow


def test_delete_stage_refuses_when_rules_exist(db_session):
    workflow = _fresh_workflow(db_session)
    stage = workflow.stages[0]
    db_session.add(
        Rule(
            workflow_id=workflow.id,
            stage_id=stage.id,
            code="test.rule",
            name="Test rule",
            action=RuleActionType.BLOCK,
            severity=RuleSeverity.CRITICAL,
            risk_weight=10,
        )
    )
    db_session.commit()

    with pytest.raises(workflow_service.StageDeletionRefused):
        workflow_service.delete_stage(db_session, stage)

    db_session.rollback()
    # Rules are still attached after the refusal.
    remaining = db_session.query(Rule).filter(Rule.stage_id == stage.id).count()
    assert remaining == 1


def test_delete_stage_succeeds_when_no_rules(db_session):
    workflow = _fresh_workflow(db_session)
    stage = workflow.stages[0]
    workflow_service.delete_stage(db_session, stage)
    db_session.commit()
    remaining = db_session.get(WorkflowStage, stage.id)
    assert remaining is None
