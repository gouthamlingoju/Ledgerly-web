from uuid import UUID
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, func, case
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.user import User
from app.models.contact import Contact
from app.models.ledger_entry import LedgerEntry, Direction
from app.schemas.contact import ContactCreate, ContactUpdate, ContactResponse
from app.services.auth import get_current_user

router = APIRouter(prefix="/contacts", tags=["Contacts"])


@router.post("/", response_model=ContactResponse, status_code=status.HTTP_201_CREATED)
async def create_contact(
    data: ContactCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    contact = Contact(user_id=current_user.id, name=data.name)
    db.add(contact)
    await db.flush()
    return ContactResponse.model_validate(contact)


@router.get("/", response_model=list[ContactResponse])
async def list_contacts(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Get contacts with their calculated balances
    balance_subq = (
        select(
            LedgerEntry.contact_id,
            func.coalesce(
                func.sum(
                    case(
                        (LedgerEntry.direction == Direction.credit, LedgerEntry.amount),
                        else_=-LedgerEntry.amount,
                    )
                ),
                0,
            ).label("balance"),
        )
        .where(LedgerEntry.user_id == current_user.id)
        .group_by(LedgerEntry.contact_id)
        .subquery()
    )

    result = await db.execute(
        select(Contact, balance_subq.c.balance)
        .outerjoin(balance_subq, Contact.id == balance_subq.c.contact_id)
        .where(Contact.user_id == current_user.id)
        .order_by(Contact.name)
    )

    contacts = []
    for row in result.all():
        contact = row[0]
        balance = row[1] if row[1] is not None else Decimal("0.00")
        resp = ContactResponse.model_validate(contact)
        resp.balance = balance
        contacts.append(resp)

    return contacts


@router.get("/{contact_id}", response_model=ContactResponse)
async def get_contact(
    contact_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    contact = await _get_owned_contact(contact_id, current_user.id, db)

    # Calculate balance
    result = await db.execute(
        select(
            func.coalesce(
                func.sum(
                    case(
                        (LedgerEntry.direction == Direction.credit, LedgerEntry.amount),
                        else_=-LedgerEntry.amount,
                    )
                ),
                0,
            )
        ).where(
            LedgerEntry.contact_id == contact_id,
            LedgerEntry.user_id == current_user.id,
        )
    )
    balance = result.scalar() or Decimal("0.00")

    resp = ContactResponse.model_validate(contact)
    resp.balance = balance
    return resp


@router.put("/{contact_id}", response_model=ContactResponse)
async def update_contact(
    contact_id: UUID,
    data: ContactUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    contact = await _get_owned_contact(contact_id, current_user.id, db)
    contact.name = data.name
    await db.flush()
    return ContactResponse.model_validate(contact)


@router.delete("/{contact_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_contact(
    contact_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    contact = await _get_owned_contact(contact_id, current_user.id, db)
    await db.delete(contact)
    await db.flush()


async def _get_owned_contact(
    contact_id: UUID, user_id: UUID, db: AsyncSession
) -> Contact:
    result = await db.execute(
        select(Contact).where(Contact.id == contact_id)
    )
    contact = result.scalar_one_or_none()
    if not contact:
        raise HTTPException(status_code=404, detail="Contact not found")
    if contact.user_id != user_id:
        raise HTTPException(status_code=403, detail="Not authorized")
    return contact
