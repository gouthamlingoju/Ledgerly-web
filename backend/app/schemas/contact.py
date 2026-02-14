import uuid
from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, Field


class ContactCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)


class ContactUpdate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)


class ContactResponse(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    name: str
    created_at: datetime
    balance: Decimal = Decimal("0.00")

    model_config = {"from_attributes": True}
