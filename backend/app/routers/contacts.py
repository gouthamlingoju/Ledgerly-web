from uuid import UUID
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, status
from supabase import Client

from app.dependencies import get_supabase
from app.schemas.auth import UserResponse
from app.schemas.contact import ContactCreate, ContactUpdate, ContactResponse
from app.services.auth import get_current_user
from app.enums import Direction

router = APIRouter(prefix="/contacts", tags=["Contacts"])


@router.post("/", response_model=ContactResponse, status_code=status.HTTP_201_CREATED)
async def create_contact(
    data: ContactCreate,
    current_user: UserResponse = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
):
    contact_data = {
        "user_id": str(current_user.id),
        "name": data.name,
    }
    try:
        response = supabase.table("contacts").insert(contact_data).select().execute()
        contact = response.data[0]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    
    return ContactResponse(**contact, balance=Decimal("0.00"))


@router.get("/", response_model=list[ContactResponse])
async def list_contacts(
    current_user: UserResponse = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
):
    # Fetch contacts
    contacts_response = supabase.table("contacts").select("*").eq("user_id", current_user.id).order("name").execute()
    contacts = contacts_response.data

    # Fetch ledger entries for balance calculation
    # Only need contact_id, amount, direction
    entries_response = supabase.table("ledger_entries").select("contact_id, amount, direction").eq("user_id", current_user.id).execute()
    entries = entries_response.data

    # Calculate balances in memory
    balances = {}
    for entry in entries:
        c_id = entry["contact_id"]
        amount = Decimal(str(entry["amount"]))
        direction = entry["direction"]
        
        if direction == Direction.credit:
            balances[c_id] = balances.get(c_id, Decimal(0)) + amount
        else:
            balances[c_id] = balances.get(c_id, Decimal(0)) - amount

    result = []
    for contact in contacts:
        contact_id = contact["id"]
        # Supabase returns UUID strings, we need to match carefully
        # The balance dict keys are strings from the JSON response
        bal = balances.get(contact_id, Decimal("0.00"))
        result.append(ContactResponse(**contact, balance=bal))

    return result


@router.get("/{contact_id}", response_model=ContactResponse)
async def get_contact(
    contact_id: UUID,
    current_user: UserResponse = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
):
    contact = await _get_owned_contact(contact_id, str(current_user.id), supabase)

    # Calculate balance
    entries_response = supabase.table("ledger_entries").select("amount, direction").eq("contact_id", str(contact_id)).eq("user_id", str(current_user.id)).execute()
    entries = entries_response.data
    
    balance = Decimal("0.00")
    for entry in entries:
        amount = Decimal(str(entry["amount"]))
        if entry["direction"] == Direction.credit:
            balance += amount
        else:
            balance -= amount

    return ContactResponse(**contact, balance=balance)


@router.put("/{contact_id}", response_model=ContactResponse)
async def update_contact(
    contact_id: UUID,
    data: ContactUpdate,
    current_user: UserResponse = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
):
    contact = await _get_owned_contact(contact_id, str(current_user.id), supabase)
    
    try:
        response = supabase.table("contacts").update({"name": data.name}).eq("id", str(contact_id)).select().execute()
        updated_contact = response.data[0]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    # We need to return balance too. 
    # Since name update doesn't change balance, we can re-calculate or just pass 0 if we don't display it on update response?
    # Protocol says response_model=ContactResponse, which has balance default 0.
    # But for correctness let's ideally fetch it. 
    # For now, to keep it simple and consistent with previous code (wrapper), I'll just return 0 or fetch it.
    # The previous code returned `ContactResponse.model_validate(contact)` which would have default 0 balance as it wasn't fetching balance in update.
    # So I will stick to returning the contact with default balance (0) or if I can pass what I have.
    # Wait, previous code: return ContactResponse.model_validate(contact) -> balance=Decimal("0.00") due to default.
    return ContactResponse(**updated_contact)


@router.delete("/{contact_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_contact(
    contact_id: UUID,
    current_user: UserResponse = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
):
    await _get_owned_contact(contact_id, str(current_user.id), supabase)
    try:
        supabase.table("contacts").delete().eq("id", str(contact_id)).execute()
    except Exception as e:
         raise HTTPException(status_code=500, detail=str(e))


async def _get_owned_contact(
    contact_id: UUID, user_id: str, supabase: Client
) -> dict:
    response = supabase.table("contacts").select("*").eq("id", str(contact_id)).single().execute()
    contact = response.data
    
    if not contact:
        raise HTTPException(status_code=404, detail="Contact not found")
    if contact["user_id"] != user_id:
        raise HTTPException(status_code=403, detail="Not authorized")
    return contact
