from datetime import datetime, timedelta, timezone

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from passlib.context import CryptContext
from supabase import Client

from app.config import get_settings
from app.dependencies import get_supabase
from app.lending.database import get_db
from app.schemas.auth import UserResponse

settings = get_settings()
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")


def hash_password(password: str) -> str:
    return pwd_context.hash(password)



def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


def create_access_token(data: dict) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(
        minutes=settings.access_token_expire_minutes
    )
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, settings.secret_key, algorithm=settings.algorithm)


async def get_current_user(
    token: str = Depends(oauth2_scheme),
    supabase: Client = Depends(get_supabase),
) -> UserResponse:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(
            token, settings.secret_key, algorithms=[settings.algorithm]
        )
        if payload.get("actor", "owner") != "owner":
            raise credentials_exception
        user_id: str | None = payload.get("sub")
        if user_id is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    try:
        response = supabase.table("users").select("*").eq("id", user_id).single().execute()
        user_data = response.data
    except Exception:
        raise credentials_exception

    if not user_data:
        raise credentials_exception
        
    return UserResponse(**user_data)

async def get_current_counterparty(
    token: str = Depends(oauth2_scheme),
    conn = Depends(get_db),
) -> dict:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate counterparty credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])
        if payload.get("actor") != "counterparty" or not payload.get("sub"):
            raise credentials_exception
        counterparty_id = payload["sub"]
    except (JWTError, TypeError):
        raise credentials_exception

    row = await conn.fetchrow("""
        SELECT cp.id, cp.name, cp.user_id, a.must_change_password
        FROM lending_counterparties cp
        JOIN lending_counterparty_access a ON a.counterparty_id = cp.id
        WHERE cp.id = $1 AND a.enabled = TRUE
    """, counterparty_id)
    if not row:
        raise credentials_exception
    return dict(row)

def require_counterparty_password_changed(counterparty: dict) -> None:
    if counterparty["must_change_password"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Password change required before viewing loans",
        )
