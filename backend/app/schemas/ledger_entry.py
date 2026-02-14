import uuid
from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, Field

from app.models.ledger_entry import Direction


class LedgerEntryCreate(BaseModel):
    contact_id: uuid.UUID
    direction: Direction
    amount: Decimal = Field(..., gt=0, max_digits=12, decimal_places=2)
    note: str | None = Field(None, max_length=500)


class LedgerEntryResponse(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    contact_id: uuid.UUID
    direction: Direction
    amount: Decimal
    note: str | None
    created_at: datetime
    contact_name: str | None = None

    model_config = {"from_attributes": True}


class BalanceResponse(BaseModel):
    contact_id: uuid.UUID
    contact_name: str
    balance: Decimal
    total_credit: Decimal
    total_debit: Decimal
