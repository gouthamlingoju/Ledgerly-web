from fastapi import APIRouter, Depends, HTTPException, status
import asyncpg
from typing import List
from uuid import UUID

from app.lending.schemas import (
    CounterpartyResponse, CounterpartyCreate, CounterpartyUpdate,
    LoanResponse, LoanCreate, LoanUpdate,
    RepaymentRequest, ExtensionRequest, SettlementRequest, LoanTransactionResponse,
    LoanWithCounterparty, LoanDetailResponse, CounterpartyDetailResponse,
    TransactionUpdate
)
from app.lending import services
from app.lending.database import get_db
from app.services.auth import get_current_user
from app.schemas.auth import UserResponse

router = APIRouter(prefix="/lending", tags=["Lending Management"])

@router.get("/counterparties", response_model=List[CounterpartyResponse])
async def list_counterparties(
    current_user: UserResponse = Depends(get_current_user),
    conn: asyncpg.Connection = Depends(get_db)
):
    return await services.list_counterparties(conn, current_user.id)

@router.post("/counterparties", response_model=CounterpartyResponse, status_code=status.HTTP_201_CREATED)
async def create_counterparty(
    data: CounterpartyCreate,
    current_user: UserResponse = Depends(get_current_user),
    conn: asyncpg.Connection = Depends(get_db)
):
    return await services.create_counterparty(conn, current_user.id, data)

@router.delete("/counterparties/{cp_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_counterparty(
    cp_id: UUID,
    current_user: UserResponse = Depends(get_current_user),
    conn: asyncpg.Connection = Depends(get_db)
):
    await services.delete_counterparty(conn, current_user.id, cp_id)
    return None

@router.patch("/counterparties/{cp_id}", response_model=CounterpartyResponse)
async def update_counterparty(
    cp_id: UUID,
    data: CounterpartyUpdate,
    current_user: UserResponse = Depends(get_current_user),
    conn: asyncpg.Connection = Depends(get_db)
):
    return await services.update_counterparty(conn, current_user.id, cp_id, data)

@router.get("/counterparties/{cp_id}/detail", response_model=CounterpartyDetailResponse)
async def get_counterparty_detail(
    cp_id: UUID,
    current_user: UserResponse = Depends(get_current_user),
    conn: asyncpg.Connection = Depends(get_db)
):
    return await services.get_counterparty_detail(conn, current_user.id, cp_id)

@router.post("/loans", response_model=LoanResponse, status_code=status.HTTP_201_CREATED)
async def create_loan(
    data: LoanCreate,
    current_user: UserResponse = Depends(get_current_user),
    conn: asyncpg.Connection = Depends(get_db)
):
    return await services.create_loan(conn, current_user.id, data)

@router.post("/loans/{loan_id}/repayment", response_model=LoanResponse)
async def process_repayment(
    loan_id: UUID,
    data: RepaymentRequest,
    current_user: UserResponse = Depends(get_current_user),
    conn: asyncpg.Connection = Depends(get_db)
):
    return await services.process_repayment(conn, current_user.id, loan_id, data)

@router.post("/loans/{loan_id}/extend", response_model=LoanResponse)
async def process_extension(
    loan_id: UUID,
    data: ExtensionRequest,
    current_user: UserResponse = Depends(get_current_user),
    conn: asyncpg.Connection = Depends(get_db)
):
    return await services.process_manual_extension(conn, current_user.id, loan_id, data)

@router.post("/loans/{loan_id}/settle", response_model=LoanResponse)
async def process_settlement(
    loan_id: UUID,
    data: SettlementRequest,
    current_user: UserResponse = Depends(get_current_user),
    conn: asyncpg.Connection = Depends(get_db)
):
    return await services.process_settlement(conn, current_user.id, loan_id, data)

@router.get("/dashboard")
async def get_dashboard(
    current_user: UserResponse = Depends(get_current_user),
    conn: asyncpg.Connection = Depends(get_db)
):
    return await services.get_dashboard_metrics(conn, current_user.id)

@router.get("/loans", response_model=List[LoanWithCounterparty])
async def list_loans(
    current_user: UserResponse = Depends(get_current_user),
    conn: asyncpg.Connection = Depends(get_db)
):
    return await services.list_loans(conn, current_user.id)

@router.get("/loans/{loan_id}", response_model=LoanDetailResponse)
async def get_loan_details(
    loan_id: UUID,
    current_user: UserResponse = Depends(get_current_user),
    conn: asyncpg.Connection = Depends(get_db)
):
    return await services.get_loan_detail(conn, current_user.id, loan_id)

@router.patch("/loans/{loan_id}", response_model=LoanResponse)
async def update_loan(
    loan_id: UUID,
    data: LoanUpdate,
    current_user: UserResponse = Depends(get_current_user),
    conn: asyncpg.Connection = Depends(get_db)
):
    return await services.update_loan(conn, current_user.id, loan_id, data)

@router.delete("/loans/{loan_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_loan(
    loan_id: UUID,
    current_user: UserResponse = Depends(get_current_user),
    conn: asyncpg.Connection = Depends(get_db)
):
    await services.delete_loan(conn, current_user.id, loan_id)
    return None

@router.patch("/transactions/{transaction_id}", response_model=LoanTransactionResponse)
async def update_transaction(
    transaction_id: UUID,
    data: TransactionUpdate,
    current_user: UserResponse = Depends(get_current_user),
    conn: asyncpg.Connection = Depends(get_db)
):
    return await services.update_transaction(conn, current_user.id, transaction_id, data)

@router.delete("/transactions/{transaction_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_transaction(
    transaction_id: UUID,
    current_user: UserResponse = Depends(get_current_user),
    conn: asyncpg.Connection = Depends(get_db)
):
    await services.delete_transaction(conn, current_user.id, transaction_id)
    return None
