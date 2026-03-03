from datetime import date, datetime
from typing import Optional, List
from decimal import Decimal
from pydantic import BaseModel, ConfigDict
from enum import Enum
from uuid import UUID

class CounterpartyStatus(str, Enum):
    ACTIVE = 'active'
    INACTIVE = 'inactive'

class LoanType(str, Enum):
    LENT = 'lent'
    BORROWED = 'borrowed'

class LoanStatus(str, Enum):
    ACTIVE = 'active'
    DUE = 'due'
    OVERDUE = 'overdue'
    CLOSED = 'closed'
    SETTLED = 'settled'

class TransactionType(str, Enum):
    DISBURSEMENT = 'disbursement'
    REPAYMENT = 'repayment'
    CAPITALIZATION = 'capitalization'
    SETTLEMENT = 'settlement'
    ADJUSTMENT = 'adjustment'

class CashFlowDirection(str, Enum):
    IN_FL = 'in'  # keeping IN_FL variable name to avoid reserved word conflicts in some contexts
    OUT = 'out'
    NONE = 'none'

class CounterpartyResponse(BaseModel):
    id: UUID
    user_id: UUID
    name: str
    phone: Optional[str] = None
    notes: Optional[str] = None
    status: CounterpartyStatus
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

class CounterpartyCreate(BaseModel):
    name: str
    phone: Optional[str] = None
    notes: Optional[str] = None

class CounterpartyUpdate(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    notes: Optional[str] = None
    status: Optional[CounterpartyStatus] = None

class LoanResponse(BaseModel):
    id: UUID
    user_id: UUID
    counterparty_id: UUID
    type: LoanType
    original_principal: Decimal
    current_principal: Decimal
    interest_rate: Decimal
    duration_months: int
    start_date: date
    cycle_start_date: date
    due_date: date
    status: LoanStatus
    total_interest_paid: Decimal
    total_interest_capitalized: Decimal
    interest_paid_in_cycle: Decimal
    settlement_amount: Optional[Decimal] = None
    settlement_difference: Optional[Decimal] = None
    created_at: datetime
    closed_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)

class LoanWithCounterparty(LoanResponse):
    counterparty_name: str

class LoanTransactionResponse(BaseModel):
    id: UUID
    loan_id: UUID
    user_id: UUID
    transaction_type: TransactionType
    cash_flow_direction: CashFlowDirection
    total_amount: Decimal
    principal_component: Decimal
    interest_component: Decimal
    transaction_date: date
    notes: Optional[str] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

class LoanDetailResponse(BaseModel):
    loan: LoanWithCounterparty
    transactions: List[LoanTransactionResponse]
    counterparty: CounterpartyResponse

class CounterpartyDetailResponse(BaseModel):
    counterparty: CounterpartyResponse
    loans: List[LoanResponse]

class RepaymentRequest(BaseModel):
    amount: Decimal
    transaction_date: date
    notes: Optional[str] = None

class ExtensionRequest(BaseModel):
    notes: Optional[str] = None

class SettlementRequest(BaseModel):
    settlement_amount: Decimal
    transaction_date: date
    notes: Optional[str] = "Settled manually"

class LoanCreate(BaseModel):
    counterparty_id: UUID
    type: LoanType
    original_principal: Decimal
    interest_rate: Decimal
    duration_months: Optional[int] = 1
    start_date: date
