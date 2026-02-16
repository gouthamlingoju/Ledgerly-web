from uuid import UUID
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, status
from supabase import Client

from app.dependencies import get_supabase
from app.enums import Direction
from app.schemas.auth import UserResponse
from app.schemas.ledger_entry import LedgerEntryCreate, LedgerEntryResponse, BalanceResponse
from app.services.auth import get_current_user

router = APIRouter(prefix="/ledger", tags=["Ledger Entries"])


@router.post("/entries", response_model=LedgerEntryResponse, status_code=status.HTTP_201_CREATED)
async def create_entry(
    data: LedgerEntryCreate,
    current_user: UserResponse = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
):
    # Verify contact ownership
    contact_response = supabase.table("contacts").select("*").eq("id", str(data.contact_id)).single().execute()
    contact = contact_response.data
    
    if not contact:
        raise HTTPException(status_code=404, detail="Contact not found")
    if contact["user_id"] != str(current_user.id):
        raise HTTPException(status_code=403, detail="Not authorized")

    entry_data = {
        "user_id": str(current_user.id),
        "contact_id": str(data.contact_id),
        "direction": data.direction.value,
        "amount": float(data.amount),
        "note": data.note,
    }
    
    try:
        response = supabase.table("ledger_entries").insert(entry_data).select().execute()
        entry = response.data[0]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    return LedgerEntryResponse(**entry, contact_name=contact["name"])


@router.get("/entries", response_model=list[LedgerEntryResponse])
async def list_entries(
    contact_id: UUID | None = None,
    current_user: UserResponse = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
):
    query = supabase.table("ledger_entries").select("*").eq("user_id", str(current_user.id))
    
    if contact_id:
        query = query.eq("contact_id", str(contact_id))
    
    query = query.order("created_at", desc=True)
    response = query.execute()
    entries = response.data
    
    # Fetch contacts to map names
    # Optimization: If filtering by contact_id, we only need that one contact.
    contacts_map = {}
    if contact_id:
        c_resp = supabase.table("contacts").select("id, name").eq("id", str(contact_id)).single().execute()
        if c_resp.data:
            contacts_map[str(contact_id)] = c_resp.data["name"]
    else:
        # Fetch all user contacts
        c_resp = supabase.table("contacts").select("id, name").eq("user_id", str(current_user.id)).execute()
        for c in c_resp.data:
            contacts_map[c["id"]] = c["name"]

    result = []
    for entry in entries:
        # Supabase returns UUIDs as strings
        c_name = contacts_map.get(entry["contact_id"])
        result.append(LedgerEntryResponse(**entry, contact_name=c_name))
        
    return result


@router.get("/entries/{entry_id}", response_model=LedgerEntryResponse)
async def get_entry(
    entry_id: UUID,
    current_user: UserResponse = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
):
    response = supabase.table("ledger_entries").select("*").eq("id", str(entry_id)).single().execute()
    entry = response.data
    
    if not entry:
        raise HTTPException(status_code=404, detail="Entry not found")
    if entry["user_id"] != str(current_user.id):
        raise HTTPException(status_code=403, detail="Not authorized")
        
    # Fetch contact name
    c_resp = supabase.table("contacts").select("name").eq("id", entry["contact_id"]).single().execute()
    contact_name = c_resp.data["name"] if c_resp.data else None
    
    return LedgerEntryResponse(**entry, contact_name=contact_name)


@router.delete("/entries/{entry_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_entry(
    entry_id: UUID,
    current_user: UserResponse = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
):
    # Verify ownership before delete? 
    # Or just try to delete with matching user_id. 
    # Supabase will return count 0 if not found/matching.
    # But usually we want to return 404/403 explicit.
    
    response = supabase.table("ledger_entries").select("*").eq("id", str(entry_id)).single().execute()
    entry = response.data
    
    if not entry:
        raise HTTPException(status_code=404, detail="Entry not found")
    if entry["user_id"] != str(current_user.id):
         raise HTTPException(status_code=403, detail="Not authorized")
         
    supabase.table("ledger_entries").delete().eq("id", str(entry_id)).execute()


@router.get("/balance/{contact_id}", response_model=BalanceResponse)
async def get_balance(
    contact_id: UUID,
    current_user: UserResponse = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
):
    # Verify contact
    c_resp = supabase.table("contacts").select("*").eq("id", str(contact_id)).single().execute()
    contact = c_resp.data
    
    if not contact:
        raise HTTPException(status_code=404, detail="Contact not found")
    if contact["user_id"] != str(current_user.id):
        raise HTTPException(status_code=403, detail="Not authorized")

    # Fetch entries
    entries_resp = supabase.table("ledger_entries").select("amount, direction").eq("contact_id", str(contact_id)).eq("user_id", str(current_user.id)).execute()
    entries = entries_resp.data
    
    total_credit = Decimal("0")
    total_debit = Decimal("0")
    
    for entry in entries:
        amount = Decimal(str(entry["amount"]))
        if entry["direction"] == Direction.credit:
            total_credit += amount
        else:
            total_debit += amount
            
    balance = total_credit - total_debit

    return BalanceResponse(
        contact_id=contact_id,
        contact_name=contact["name"],
        balance=balance,
        total_credit=total_credit,
        total_debit=total_debit,
    )


@router.get("/balances", response_model=list[BalanceResponse])
async def get_all_balances(
    current_user: UserResponse = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
):
    # Fetch contacts
    c_resp = supabase.table("contacts").select("id, name").eq("user_id", str(current_user.id)).order("name").execute()
    contacts = c_resp.data
    
    # Fetch all entries
    e_resp = supabase.table("ledger_entries").select("contact_id, amount, direction").eq("user_id", str(current_user.id)).execute()
    entries = e_resp.data
    
    # Aggregate
    # balances[contact_id] = {"credit": 0, "debit": 0}
    balances_map = {}
    
    for entry in entries:
        c_id = entry["contact_id"]
        amount = Decimal(str(entry["amount"]))
        direction = entry["direction"]
        
        if c_id not in balances_map:
            balances_map[c_id] = {"credit": Decimal(0), "debit": Decimal(0)}
            
        if direction == Direction.credit:
            balances_map[c_id]["credit"] += amount
        else:
            balances_map[c_id]["debit"] += amount
            
    result = []
    for contact in contacts:
        c_id = contact["id"]
        name = contact["name"]
        
        stats = balances_map.get(c_id, {"credit": Decimal(0), "debit": Decimal(0)})
        total_credit = stats["credit"]
        total_debit = stats["debit"]
        balance = total_credit - total_debit
        
        result.append(
            BalanceResponse(
                contact_id=UUID(c_id), # Pydantic expects UUID object if defined as UUID
                contact_name=name,
                balance=balance,
                total_credit=total_credit,
                total_debit=total_debit,
            )
        )
        
    return result
