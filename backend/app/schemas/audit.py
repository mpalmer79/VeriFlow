from datetime import datetime
from typing import Any, Dict, Optional

from pydantic import BaseModel, ConfigDict


class AuditEntryRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    action: str
    entity_type: str
    entity_id: Optional[int]
    actor_user_id: Optional[int]
    record_id: Optional[int]
    payload: Optional[Dict[str, Any]]
    created_at: datetime
