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
    LoanWithCounterparty, LoanDetailResponse, CounterpartyDetailResponse,
    LoanUpdate, TransactionUpdate
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

async def delete_loan(conn: asyncpg.Connection, user_id: UUID, loan_id: UUID):
    # Verify ownership
    res = await conn.execute("DELETE FROM lending_loans WHERE id = $1 AND user_id = $2", str(loan_id), str(user_id))
    if res == "DELETE 0":
        raise HTTPException(status_code=404, detail="Loan not found")

async def update_loan(conn: asyncpg.Connection, user_id: UUID, loan_id: UUID, data: LoanUpdate) -> LoanResponse:
    async with conn.transaction():
        loan = await conn.fetchrow("SELECT * FROM lending_loans WHERE id = $1 AND user_id = $2 FOR UPDATE", str(loan_id), str(user_id))
        if not loan:
            raise HTTPException(status_code=404, detail="Loan not found")
        
        fields = []
        values = [str(loan_id)]
        
        if data.original_principal is not None:
            # Update principals
            diff = data.original_principal - loan["original_principal"]
            fields.append(f"original_principal = ${len(values)+1}::numeric")
            values.append(data.original_principal)
            fields.append(f"current_principal = current_principal + ${len(values)+1}::numeric")
            values.append(diff)
            
            # Update initial disbursement transaction
            await conn.execute("""
                UPDATE lending_transactions 
                SET total_amount = $1, principal_component = $1 
                WHERE loan_id = $2 AND transaction_type = 'disbursement'
            """, data.original_principal, str(loan_id))
            
        if data.interest_rate is not None:
            fields.append(f"interest_rate = ${len(values)+1}")
            values.append(data.interest_rate)
        if data.duration_months is not None:
            fields.append(f"duration_months = ${len(values)+1}")
            values.append(data.duration_months)
        if data.due_date is not None:
            fields.append(f"due_date = ${len(values)+1}")
            values.append(data.due_date)
        if data.status is not None:
            fields.append(f"status = ${len(values)+1}")
            values.append(data.status.value)
            
        if not fields:
            return LoanResponse(**dict(loan))
            
        query = f"UPDATE lending_loans SET {', '.join(fields)} WHERE id = $1 RETURNING *"
        row = await conn.fetchrow(query, *values)
        return LoanResponse(**dict(row))

async def _apply_transaction_to_loan(conn: asyncpg.Connection, loan_id: UUID, user_id: UUID, tx_type: str, total_amount: Decimal, principal: Decimal, interest: Decimal, direction: str, undo: bool = False):
    """Internal helper to apply or undo a transaction's impact on a loan balance."""
    # This is a simplified version of the logic in process_repayment, etc.
    # In a real app, we'd refactor the original process functions to use this.
    
    multiplier = -1 if undo else 1
    
    if tx_type == TransactionType.REPAYMENT.value:
        await conn.execute("""
            UPDATE lending_loans SET 
                current_principal = current_principal - $1,
                total_interest_paid = total_interest_paid - $2,
                interest_paid_in_cycle = interest_paid_in_cycle - $2,
                status = CASE WHEN (current_principal - $1) > 0 THEN 'active' ELSE 'closed' END,
                closed_at = CASE WHEN (current_principal - $1) <= 0 THEN NOW() ELSE NULL END
            WHERE id = $3
        """, principal * multiplier, interest * multiplier, str(loan_id))
        
    elif tx_type == TransactionType.CAPITALIZATION.value:
        await conn.execute("""
            UPDATE lending_loans SET 
                current_principal = current_principal + $1,
                total_interest_capitalized = total_interest_capitalized + $2
            WHERE id = $3
        """, principal * multiplier, interest * multiplier, str(loan_id))

    elif tx_type == TransactionType.SETTLEMENT.value:
        if undo:
            # Revert from settled to active. We need the previous principal. 
            # In update_transaction/delete_transaction, we'll have retrieved the tx total_amount or components.
            # Settlements are special. For now, let's assume restoring to active.
            await conn.execute("""
                UPDATE lending_loans SET 
                    current_principal = $1,
                    status = 'active',
                    closed_at = NULL,
                    settlement_amount = NULL,
                    settlement_difference = NULL
                WHERE id = $2
            """, principal, str(loan_id))
        else:
            await conn.execute("""
                UPDATE lending_loans SET 
                    current_principal = 0,
                    status = 'settled',
                    closed_at = NOW(),
                    settlement_amount = $1,
                    settlement_difference = settlement_difference -- remains same or recalculated? 
                WHERE id = $2
            """, total_amount, str(loan_id))

async def delete_transaction(conn: asyncpg.Connection, user_id: UUID, transaction_id: UUID):
    async with conn.transaction():
        tx = await conn.fetchrow("SELECT * FROM lending_transactions WHERE id = $1 AND user_id = $2 FOR UPDATE", str(transaction_id), str(user_id))
        if not tx:
            raise HTTPException(status_code=404, detail="Transaction not found")
        
        if tx["transaction_type"] == TransactionType.DISBURSEMENT.value:
            raise HTTPException(status_code=400, detail="Initial disbursement cannot be deleted. Delete the loan instead.")
            
        # Rollback the impact of this transaction
        await _apply_transaction_to_loan(
            conn, tx["loan_id"], user_id, 
            tx["transaction_type"], tx["total_amount"], 
            tx["principal_component"], tx["interest_component"], 
            tx["cash_flow_direction"], undo=True
        )
        
        await conn.execute("DELETE FROM lending_transactions WHERE id = $1", str(transaction_id))

async def update_transaction(conn: asyncpg.Connection, user_id: UUID, transaction_id: UUID, data: TransactionUpdate) -> LoanTransactionResponse:
    async with conn.transaction():
        tx = await conn.fetchrow("SELECT * FROM lending_transactions WHERE id = $1 AND user_id = $2 FOR UPDATE", str(transaction_id), str(user_id))
        if not tx:
            raise HTTPException(status_code=404, detail="Transaction not found")
            
        if tx["transaction_type"] == TransactionType.DISBURSEMENT.value:
            # Can only update notes/date for disbursement
            if data.total_amount is not None and data.total_amount != tx["total_amount"]:
                raise HTTPException(status_code=400, detail="Cannot change disbursement amount after creation. Delete and recreate loan.")
        
        # If amount changed, we need to rollback old and apply new
        if data.total_amount is not None and data.total_amount != tx["total_amount"]:
            # Rollback old
            await _apply_transaction_to_loan(
                conn, tx["loan_id"], user_id, 
                tx["transaction_type"], tx["total_amount"], 
                tx["principal_component"], tx["interest_component"], 
                tx["cash_flow_direction"], undo=True
            )
            
            # Recalculate components based on new amount (simple logic for now)
            # In a real app, we might need a more complex redistribution logic
            # For repayment, we'll follow the same logic as process_repayment (interest first)
            new_total = data.total_amount
            new_principal = tx["principal_component"]
            new_interest = tx["interest_component"]
            
            if tx["transaction_type"] == TransactionType.REPAYMENT.value:
                # We'd need current loan state to redo interest calculation accurately, 
                # but for an edit, let's keep the split or prompt user?
                # Let's assume the user wants to adjust total and we keep interest same unless total < original interest.
                if new_total >= tx["interest_component"]:
                    new_interest = tx["interest_component"]
                    new_principal = new_total - new_interest
                else:
                    new_interest = new_total
                    new_principal = Decimal('0.00')
            
            # Apply new
            await _apply_transaction_to_loan(
                conn, tx["loan_id"], user_id, 
                tx["transaction_type"], new_total, 
                new_principal, new_interest, 
                tx["cash_flow_direction"], undo=False
            )
            
            # Update values for DB update
            tx_update = {
                "total_amount": new_total,
                "principal_component": new_principal,
                "interest_component": new_interest
            }
        else:
            tx_update = {}
            
        # Build dynamic update for the transaction record
        fields = []
        values = [str(transaction_id)]
        
        for k, v in tx_update.items():
            fields.append(f"{k} = ${len(values)+1}")
            values.append(v)
            
        if data.transaction_date is not None:
            fields.append(f"transaction_date = ${len(values)+1}")
            values.append(data.transaction_date)
        if data.notes is not None:
            fields.append(f"notes = ${len(values)+1}")
            values.append(data.notes)
            
        if not fields:
            return LoanTransactionResponse(**dict(tx))
            
        query = f"UPDATE lending_transactions SET {', '.join(fields)} WHERE id = $1 RETURNING *"
        row = await conn.fetchrow(query, *values)
        return LoanTransactionResponse(**dict(row))
