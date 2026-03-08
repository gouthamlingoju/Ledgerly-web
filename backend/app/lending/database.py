import asyncpg
from typing import Optional
from app.config import get_settings

settings = get_settings()

db_pool: Optional[asyncpg.Pool] = None

async def init_db_pool():
    global db_pool
    # Requires standard postgresql URL
    # fallback to build from supabase_url and db pass if not explicitly provided
    # However we rely on the defined setting.
    if settings.database_url:
        import os
        ssl_mode = 'require' if os.getenv("DATABASE_SSL", "false").lower() == "true" else None
        
        db_pool = await asyncpg.create_pool(
            settings.database_url,
            min_size=1,
            max_size=10,
            command_timeout=60,
            ssl=ssl_mode
        )
    else:
        print("WARNING: database_url is not set. Lending module DB operations will fail.")

async def close_db_pool():
    global db_pool
    if db_pool:
        await db_pool.close()

async def get_db_connection() -> asyncpg.Connection:
    global db_pool
    if not db_pool:
        raise Exception("Database pool is not initialized")
    return db_pool

# Dependency
async def get_db():
    if not db_pool:
        raise Exception("DB pool is not initialized")
    async with db_pool.acquire() as conn:
        yield conn
