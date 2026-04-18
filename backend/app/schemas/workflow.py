from typing import List, Optional

from pydantic import BaseModel, ConfigDict


class WorkflowStageRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    slug: str
    order_index: int
    is_terminal: bool


class WorkflowRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    slug: str
    description: Optional[str]
    stages: List[WorkflowStageRead]
