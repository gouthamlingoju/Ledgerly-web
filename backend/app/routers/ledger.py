from uuid import UUID
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, func, case
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.user import User
from app.models.contact import Contact
from app.models.ledger_entry import LedgerEntry, Direction
from app.schemas.ledger_entry import LedgerEntryCreate, LedgerEntryResponse, BalanceResponse
from app.services.auth import get_current_user

router = APIRouter(prefix="/ledger", tags=["Ledger Entries"])


@router.post("/entries", response_model=LedgerEntryResponse, status_code=status.HTTP_201_CREATED)
async def create_entry(
    data: LedgerEntryCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Verify contact ownership
    result = await db.execute(
        select(Contact).where(Contact.id == data.contact_id)
    )
    contact = result.scalar_one_or_none()
    if not contact:
        raise HTTPException(status_code=404, detail="Contact not found")
    if contact.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")

    entry = LedgerEntry(
        user_id=current_user.id,
        contact_id=data.contact_id,
        direction=data.direction,
        amount=data.amount,
        note=data.note,
    )
    db.add(entry)
    await db.flush()

    resp = LedgerEntryResponse.model_validate(entry)
    resp.contact_name = contact.name
    return resp


@router.get("/entries", response_model=list[LedgerEntryResponse])
async def list_entries(
    contact_id: UUID | None = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    query = (
        select(LedgerEntry, Contact.name.label("contact_name"))
        .join(Contact, LedgerEntry.contact_id == Contact.id)
        .where(LedgerEntry.user_id == current_user.id)
    )
    if contact_id:
        query = query.where(LedgerEntry.contact_id == contact_id)

    query = query.order_by(LedgerEntry.created_at.desc())

    result = await db.execute(query)
    entries = []
    for row in result.all():
        entry = row[0]
        resp = LedgerEntryResponse.model_validate(entry)
        resp.contact_name = row[1]
        entries.append(resp)
    return entries


@router.get("/entries/{entry_id}", response_model=LedgerEntryResponse)
async def get_entry(
    entry_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(LedgerEntry, Contact.name.label("contact_name"))
        .join(Contact, LedgerEntry.contact_id == Contact.id)
        .where(LedgerEntry.id == entry_id)
    )
    row = result.one_or_none()
    if not row:
        raise HTTPException(status_code=404, detail="Entry not found")
    entry = row[0]
    if entry.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    resp = LedgerEntryResponse.model_validate(entry)
    resp.contact_name = row[1]
    return resp


@router.delete("/entries/{entry_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_entry(
    entry_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(LedgerEntry).where(LedgerEntry.id == entry_id)
    )
    entry = result.scalar_one_or_none()
    if not entry:
        raise HTTPException(status_code=404, detail="Entry not found")
    if entry.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    await db.delete(entry)
    await db.flush()


@router.get("/balance/{contact_id}", response_model=BalanceResponse)
async def get_balance(
    contact_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Verify contact ownership
    result = await db.execute(select(Contact).where(Contact.id == contact_id))
    contact = result.scalar_one_or_none()
    if not contact:
        raise HTTPException(status_code=404, detail="Contact not found")
    if contact.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")

    result = await db.execute(
        select(
            func.coalesce(
                func.sum(
                    case(
                        (LedgerEntry.direction == Direction.credit, LedgerEntry.amount),
                        else_=Decimal("0"),
                    )
                ),
                Decimal("0"),
            ).label("total_credit"),
            func.coalesce(
                func.sum(
                    case(
                        (LedgerEntry.direction == Direction.debit, LedgerEntry.amount),
                        else_=Decimal("0"),
                    )
                ),
                Decimal("0"),
            ).label("total_debit"),
        ).where(
            LedgerEntry.contact_id == contact_id,
            LedgerEntry.user_id == current_user.id,
        )
    )
    row = result.one()
    total_credit = row[0]
    total_debit = row[1]
    balance = total_credit - total_debit

    return BalanceResponse(
        contact_id=contact_id,
        contact_name=contact.name,
        balance=balance,
        total_credit=total_credit,
        total_debit=total_debit,
    )


@router.get("/balances", response_model=list[BalanceResponse])
async def get_all_balances(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(
            Contact.id,
            Contact.name,
            func.coalesce(
                func.sum(
                    case(
                        (LedgerEntry.direction == Direction.credit, LedgerEntry.amount),
                        else_=Decimal("0"),
                    )
                ),
                Decimal("0"),
            ).label("total_credit"),
            func.coalesce(
                func.sum(
                    case(
                        (LedgerEntry.direction == Direction.debit, LedgerEntry.amount),
                        else_=Decimal("0"),
                    )
                ),
                Decimal("0"),
            ).label("total_debit"),
        )
        .outerjoin(LedgerEntry, Contact.id == LedgerEntry.contact_id)
        .where(Contact.user_id == current_user.id)
        .group_by(Contact.id, Contact.name)
        .order_by(Contact.name)
    )

    balances = []
    for row in result.all():
        total_credit = row[2]
        total_debit = row[3]
        balances.append(
            BalanceResponse(
                contact_id=row[0],
                contact_name=row[1],
                balance=total_credit - total_debit,
                total_credit=total_credit,
                total_debit=total_debit,
            )
        )
    return balances
