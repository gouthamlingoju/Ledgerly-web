from datetime import date, datetime
from decimal import Decimal
from typing import List, Optional
from uuid import UUID
import asyncpg
from fastapi import HTTPException
from dateutil.relativedelta import relativedelta

from app.lending.schemas import (
    CounterpartyCreate, CounterpartyResponse,
    LoanCreate, LoanResponse, LoanStatus, LoanType,
    TransactionType, CashFlowDirection,
    RepaymentRequest, ExtensionRequest, SettlementRequest, LoanTransactionResponse,
    LoanWithCounterparty, LoanDetailResponse, CounterpartyDetailResponse
)
from app.lending.calculations import compute_interest_snapshot

async def create_counterparty(conn: asyncpg.Connection, user_id: UUID, data: CounterpartyCreate) -> CounterpartyResponse:
    row = await conn.fetchrow("""
        INSERT INTO lending_counterparties (user_id, name, phone, notes, status)
        VALUES ($1, $2, $3, $4, 'active')
        RETURNING *
    """, str(user_id), data.name, data.phone, data.notes)
    return CounterpartyResponse(**dict(row))

async def list_counterparties(conn: asyncpg.Connection, user_id: UUID) -> List[CounterpartyResponse]:
    rows = await conn.fetch("""
        SELECT * FROM lending_counterparties WHERE user_id = $1 ORDER BY name ASC
    """, str(user_id))
    return [CounterpartyResponse(**dict(row)) for row in rows]

async def update_counterparty(conn: asyncpg.Connection, user_id: UUID, cp_id: UUID, data: any) -> CounterpartyResponse:
    # Build dynamic update
    fields = []
    values = [str(user_id), str(cp_id)]
    
    if data.name is not None:
        fields.append(f"name = ${len(values)+1}")
        values.append(data.name)
    if data.phone is not None:
        fields.append(f"phone = ${len(values)+1}")
        values.append(data.phone)
    if data.notes is not None:
        fields.append(f"notes = ${len(values)+1}")
        values.append(data.notes)
    if data.status is not None:
        fields.append(f"status = ${len(values)+1}")
        values.append(data.status.value)
        
    if not fields:
        row = await conn.fetchrow("SELECT * FROM lending_counterparties WHERE id = $2 AND user_id = $1", *values)
        return CounterpartyResponse(**dict(row))

    query = f"UPDATE lending_counterparties SET {', '.join(fields)} WHERE id = $2 AND user_id = $1 RETURNING *"
    row = await conn.fetchrow(query, *values)
    if not row:
        raise HTTPException(status_code=404, detail="Counterparty not found")
    return CounterpartyResponse(**dict(row))

async def delete_counterparty(conn: asyncpg.Connection, user_id: UUID, cp_id: UUID):
    # Check if there are loans
    loans = await conn.fetchval("SELECT COUNT(*) FROM lending_loans WHERE counterparty_id = $1", str(cp_id))
    if loans > 0:
        raise HTTPException(status_code=400, detail="Cannot delete counterparty with active or past loans. Set status to inactive instead.")
    
    res = await conn.execute("DELETE FROM lending_counterparties WHERE id = $1 AND user_id = $2", str(cp_id), str(user_id))
    if res == "DELETE 0":
        raise HTTPException(status_code=404, detail="Counterparty not found")

async def create_loan(conn: asyncpg.Connection, user_id: UUID, data: LoanCreate) -> LoanResponse:
    # Verify counterparty ownership
    cp = await conn.fetchrow("SELECT id FROM lending_counterparties WHERE id = $1 AND user_id = $2", str(data.counterparty_id), str(user_id))
    if not cp:
        raise HTTPException(status_code=404, detail="Counterparty not found")

    # Monthly duration logic
    due_date = data.start_date + relativedelta(months=data.duration_months)

    async with conn.transaction():
        # Insert Loan
        loan_row = await conn.fetchrow("""
            INSERT INTO lending_loans (
                user_id, counterparty_id, type, original_principal, current_principal, 
                interest_rate, duration_months, start_date, cycle_start_date, due_date, status
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'active')
            RETURNING *
        """, 
            str(user_id), str(data.counterparty_id), data.type.value, 
            data.original_principal, data.original_principal, data.interest_rate,
            data.duration_months, data.start_date, data.start_date, due_date
        )
        loan = dict(loan_row)

        # Insert disbursement transaction
        direction = CashFlowDirection.OUT.value if data.type == LoanType.LENT else CashFlowDirection.IN_FL.value
        await conn.execute("""
            INSERT INTO lending_transactions (
                loan_id, user_id, transaction_type, cash_flow_direction, 
                total_amount, principal_component, interest_component, transaction_date, notes
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        """,
            loan["id"], str(user_id), TransactionType.DISBURSEMENT.value, direction,
            data.original_principal, data.original_principal, Decimal('0.00'), data.start_date, "Initial Disbursement"
        )
        
    return LoanResponse(**loan)

async def _get_loan_for_update(conn: asyncpg.Connection, loan_id: UUID, user_id: UUID) -> dict:
    loan = await conn.fetchrow("""
        SELECT * FROM lending_loans WHERE id = $1 AND user_id = $2 FOR UPDATE
    """, str(loan_id), str(user_id))
    if not loan:
        raise HTTPException(status_code=404, detail="Loan not found")
    if loan["status"] in ('closed', 'settled'):
        raise HTTPException(status_code=400, detail="Cannot modify closed or settled loan")
    return dict(loan)

async def process_repayment(conn: asyncpg.Connection, user_id: UUID, loan_id: UUID, data: RepaymentRequest) -> LoanResponse:
    async with conn.transaction():
        loan = await _get_loan_for_update(conn, loan_id, user_id)
        
        # Calculate interest
        calc = compute_interest_snapshot(
            current_principal=loan["current_principal"],
            monthly_interest_rate_pct=loan["interest_rate"],
            cycle_start_date=loan["cycle_start_date"],
            evaluation_date=data.transaction_date
        )
        accrued = calc["accrued_interest"]
        
        # Determine components
        if data.amount >= accrued:
            interest_paid = accrued
            principal_paid = data.amount - accrued
        else:
            interest_paid = data.amount
            principal_paid = Decimal('0.00')

        if principal_paid > loan["current_principal"]:
            # Prevent over-repaying principal
            principal_paid = loan["current_principal"]
            # Excess is kept as overpayment or refused? Let's just consume what's due.
            # Realistically, remaining goes to interest or is an error.
            # Let's adjust total amount gracefully.
            total_processed = interest_paid + principal_paid
            if data.amount > total_processed:
                raise HTTPException(status_code=400, detail="Repayment exceeds outstanding balance")

        # Update loan (RE-BASING cycle_start_date ONLY if fully paid, or just keep tracking balance)
        # Actually, let's keep it simple: Don't re-base here. Just track what's paid in this cycle.
        new_principal = loan["current_principal"] - principal_paid
        new_status = 'active' if new_principal > 0 else 'closed'
        closed_at = datetime.utcnow() if new_principal == 0 else None

        updated_loan = await conn.fetchrow("""
            UPDATE lending_loans SET 
                current_principal = $1,
                total_interest_paid = total_interest_paid + $2,
                interest_paid_in_cycle = interest_paid_in_cycle + $2,
                status = $3,
                closed_at = $4
            WHERE id = $5
            RETURNING *
        """, new_principal, interest_paid, new_status, closed_at, loan["id"])

        # Insert Transaction
        direction = CashFlowDirection.IN_FL.value if loan["type"] == 'lent' else CashFlowDirection.OUT.value
        await conn.execute("""
            INSERT INTO lending_transactions (
                loan_id, user_id, transaction_type, cash_flow_direction,
                total_amount, principal_component, interest_component, transaction_date, notes
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        """, loan["id"], str(user_id), TransactionType.REPAYMENT.value, direction,
            data.amount, principal_paid, interest_paid, data.transaction_date, data.notes)

        return LoanResponse(**dict(updated_loan))

async def process_manual_extension(conn: asyncpg.Connection, user_id: UUID, loan_id: UUID, data: ExtensionRequest) -> LoanResponse:
    today = date.today()
    async with conn.transaction():
        loan = await _get_loan_for_update(conn, loan_id, user_id)
        
        calc = compute_interest_snapshot(
            current_principal=loan["current_principal"],
            monthly_interest_rate_pct=loan["interest_rate"],
            cycle_start_date=loan["cycle_start_date"],
            evaluation_date=today
        )
        # Calculate net accrued interest (Subtracting what was already paid in this cycle)
        accrued = calc["accrued_interest"]
        net_accrued = max(Decimal('0.00'), accrued - loan["interest_paid_in_cycle"])
        
        # Monthly duration logic: extend from current due date
        base_date = max(loan["due_date"], today)
        new_due_date = base_date + relativedelta(months=loan["duration_months"])

        # Update loan (Capitalize UNPAID interest! RE-BASE cycle_start_date)
        new_principal = loan["current_principal"] + net_accrued
        updated_loan = await conn.fetchrow("""
            UPDATE lending_loans SET 
                current_principal = $1,
                total_interest_capitalized = total_interest_capitalized + $2,
                interest_paid_in_cycle = 0,
                cycle_start_date = $3,
                due_date = $4
            WHERE id = $5
            RETURNING *
        """, new_principal, net_accrued, today, new_due_date, loan["id"])

        # Insert Transaction
        await conn.execute("""
            INSERT INTO lending_transactions (
                loan_id, user_id, transaction_type, cash_flow_direction,
                total_amount, principal_component, interest_component, transaction_date, notes
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        """, loan["id"], str(user_id), TransactionType.CAPITALIZATION.value, CashFlowDirection.NONE.value,
            net_accrued, net_accrued, net_accrued, today, data.notes)

        return LoanResponse(**dict(updated_loan))

async def process_settlement(conn: asyncpg.Connection, user_id: UUID, loan_id: UUID, data: SettlementRequest) -> LoanResponse:
    async with conn.transaction():
        loan = await _get_loan_for_update(conn, loan_id, user_id)
        
        calc = compute_interest_snapshot(
            current_principal=loan["current_principal"],
            monthly_interest_rate_pct=loan["interest_rate"],
            cycle_start_date=loan["cycle_start_date"],
            evaluation_date=data.transaction_date
        )
        theoretical_total = loan["current_principal"] + calc["accrued_interest"]
        difference = data.settlement_amount - theoretical_total
        
        updated_loan = await conn.fetchrow("""
            UPDATE lending_loans SET 
                current_principal = 0,
                status = 'settled',
                closed_at = $1,
                settlement_amount = $2,
                settlement_difference = $3
            WHERE id = $4
            RETURNING *
        """, datetime.utcnow(), data.settlement_amount, difference, loan["id"])

        direction = CashFlowDirection.IN_FL.value if loan["type"] == 'lent' else CashFlowDirection.OUT.value
        await conn.execute("""
            INSERT INTO lending_transactions (
                loan_id, user_id, transaction_type, cash_flow_direction,
                total_amount, principal_component, interest_component, transaction_date, notes
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        """, loan["id"], str(user_id), TransactionType.SETTLEMENT.value, direction,
            data.settlement_amount, loan["current_principal"], calc["accrued_interest"], data.transaction_date, data.notes)

        return LoanResponse(**dict(updated_loan))

async def get_dashboard_metrics(conn: asyncpg.Connection, user_id: UUID) -> dict:
    # Just raw metrics aggregation
    # Simple groupings
    loans = await conn.fetch("SELECT * FROM lending_loans WHERE user_id = $1 AND status != 'settled' AND status != 'closed'", str(user_id))
    
    lent_active = Decimal('0')
    borrowed_active = Decimal('0')
    
    from app.lending.calculations import compute_interest_snapshot
    today = date.today()
    
    accruing_interest_lent = Decimal('0')
    accruing_interest_borrowed = Decimal('0')
    
    for l in loans:
        l_dict = dict(l)
        calc = compute_interest_snapshot(l_dict["current_principal"], l_dict["interest_rate"], l_dict["cycle_start_date"], today)
        
        if l_dict["type"] == 'lent':
            lent_active += Decimal(str(l_dict["current_principal"]))
            accruing_interest_lent += Decimal(str(calc["accrued_interest"]))
        else:
            borrowed_active += Decimal(str(l_dict["current_principal"]))
            accruing_interest_borrowed += Decimal(str(calc["accrued_interest"]))
            
    return {
        "active_lent_principal": lent_active,
        "active_borrowed_principal": borrowed_active,
        "accrued_lent_interest": accruing_interest_lent,
        "accrued_borrowed_interest": accruing_interest_borrowed,
        "available_liquidity": borrowed_active - lent_active
    }

async def list_loans(conn: asyncpg.Connection, user_id: UUID) -> List[LoanWithCounterparty]:
    rows = await conn.fetch("""
        SELECT l.*, cp.name as counterparty_name 
        FROM lending_loans l
        JOIN lending_counterparties cp ON l.counterparty_id = cp.id
        WHERE l.user_id = $1
        ORDER BY l.created_at DESC
    """, str(user_id))
    return [LoanWithCounterparty(**dict(row)) for row in rows]

async def get_loan_detail(conn: asyncpg.Connection, user_id: UUID, loan_id: UUID) -> LoanDetailResponse:
    loan_row = await conn.fetchrow("""
        SELECT l.*, cp.name as counterparty_name 
        FROM lending_loans l
        JOIN lending_counterparties cp ON l.counterparty_id = cp.id
        WHERE l.id = $1 AND l.user_id = $2
    """, str(loan_id), str(user_id))
    
    if not loan_row:
        raise HTTPException(status_code=404, detail="Loan not found")
    
    loan = LoanWithCounterparty(**dict(loan_row))
    
    cp_row = await conn.fetchrow("SELECT * FROM lending_counterparties WHERE id = $1", str(loan.counterparty_id))
    counterparty = CounterpartyResponse(**dict(cp_row))
    
    tx_rows = await conn.fetch("""
        SELECT * FROM lending_transactions 
        WHERE loan_id = $1 
        ORDER BY transaction_date DESC, created_at DESC
    """, str(loan_id))
    transactions = [LoanTransactionResponse(**dict(row)) for row in tx_rows]
    
    return LoanDetailResponse(
        loan=loan,
        transactions=transactions,
        counterparty=counterparty
    )

async def get_counterparty_detail(conn: asyncpg.Connection, user_id: UUID, cp_id: UUID) -> CounterpartyDetailResponse:
    cp_row = await conn.fetchrow("""
        SELECT * FROM lending_counterparties 
        WHERE id = $1 AND user_id = $2
    """, str(cp_id), str(user_id))
    
    if not cp_row:
        raise HTTPException(status_code=404, detail="Counterparty not found")
        
    counterparty = CounterpartyResponse(**dict(cp_row))
    
    loan_rows = await conn.fetch("""
        SELECT * FROM lending_loans 
        WHERE counterparty_id = $1 AND user_id = $2
        ORDER BY created_at DESC
    """, str(cp_id), str(user_id))
    
    loans = [LoanResponse(**dict(row)) for row in loan_rows]
    
    return CounterpartyDetailResponse(
        counterparty=counterparty,
        loans=loans
    )
