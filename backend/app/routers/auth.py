from fastapi import APIRouter, Depends, HTTPException, status
from supabase import Client

from app.dependencies import get_supabase
from app.schemas.auth import UserCreate, UserLogin, Token, UserResponse
from app.services.auth import (
    hash_password,
    verify_password,
    create_access_token,
    get_current_user,
)

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/register", response_model=Token, status_code=status.HTTP_201_CREATED)
async def register(data: UserCreate, supabase: Client = Depends(get_supabase)):
    # Check if user already exists
    response = supabase.table("users").select("email").eq("email", data.email).execute()
    if response.data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered",
        )

    # Insert new user
    user_data = {
        "email": data.email,
        "username": data.username,
        "password_hash": hash_password(data.password),
    }
    
    try:
        response = supabase.table("users").insert(user_data).select().execute()
        if not response.data:
             raise HTTPException(status_code=500, detail="Failed to create user")
        new_user = response.data[0]
    except Exception as e:
         raise HTTPException(status_code=500, detail=str(e))

    token = create_access_token({"sub": str(new_user["id"])})
    return Token(access_token=token)


@router.post("/login", response_model=Token)
async def login(data: UserLogin, supabase: Client = Depends(get_supabase)):
    # Fetch user by email or username
    try:
        # Supabase doesn't support complex OR in .eq chain easily for this case without raw SQL or multiple queries.
        # But we can use RPC or raw filter. Or fetch by email first, then username if not found.
        # Or utilize the 'or' filter: .or_(f"email.eq.{data.identifier},username.eq.{data.identifier}")
        response = supabase.table("users").select("*").or_(f"email.eq.{data.identifier},username.eq.{data.identifier}").limit(1).execute()
        user_data = response.data[0] if response.data else None
    except Exception:
        # If multiple found or error, just treat as not found for login security
        user_data = None

    if not user_data or not verify_password(data.password, user_data["password_hash"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    token = create_access_token({"sub": str(user_data["id"])})
    return Token(access_token=token)


@router.get("/me", response_model=UserResponse)
async def get_me(current_user: UserResponse = Depends(get_current_user)):
    return current_user
