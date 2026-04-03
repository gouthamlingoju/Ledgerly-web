import asyncio
import logging
import random
from contextlib import suppress
from typing import Optional

import asyncpg
from fastapi import HTTPException, status
from app.config import get_settings

settings = get_settings()
logger = logging.getLogger(__name__)

POOL_MIN_SIZE = 1
POOL_MAX_SIZE = 5
POOL_COMMAND_TIMEOUT_SECONDS = 60
POOL_CONNECT_TIMEOUT_SECONDS = 15
POOL_ACQUIRE_TIMEOUT_SECONDS = 8
POOL_RETRY_ATTEMPTS = 4
POOL_BACKOFF_BASE_SECONDS = 0.25

db_pool: Optional[asyncpg.Pool] = None
_pool_lock = asyncio.Lock()


async def _create_pool() -> asyncpg.Pool:
    return await asyncpg.create_pool(
        settings.database_url,
        min_size=POOL_MIN_SIZE,
        max_size=POOL_MAX_SIZE,
        command_timeout=POOL_COMMAND_TIMEOUT_SECONDS,
        timeout=POOL_CONNECT_TIMEOUT_SECONDS,
        max_inactive_connection_lifetime=30,
        ssl="require",
    )


async def _ensure_pool() -> asyncpg.Pool:
    global db_pool

    if db_pool:
        return db_pool

    async with _pool_lock:
        if db_pool:
            return db_pool
        if not settings.database_url:
            raise RuntimeError("DATABASE_URL is not set")
        db_pool = await _create_pool()
        return db_pool


async def _reset_pool() -> None:
    global db_pool

    async with _pool_lock:
        pool = db_pool
        db_pool = None

    if pool:
        with suppress(Exception):
            await pool.close()


async def _acquire_connection_with_retry() -> tuple[asyncpg.Pool, asyncpg.Connection]:
    last_exc: Exception | None = None

    for attempt in range(1, POOL_RETRY_ATTEMPTS + 1):
        try:
            pool = await _ensure_pool()
            conn = await pool.acquire(timeout=POOL_ACQUIRE_TIMEOUT_SECONDS)
            return pool, conn
        except Exception as exc:
            if isinstance(exc, asyncio.CancelledError):
                raise
            last_exc = exc
            logger.warning(
                "Lending DB acquire failed (attempt %s/%s): %r",
                attempt,
                POOL_RETRY_ATTEMPTS,
                exc,
            )
            await _reset_pool()
            if attempt < POOL_RETRY_ATTEMPTS:
                backoff_seconds = (POOL_BACKOFF_BASE_SECONDS * (2 ** (attempt - 1))) + random.uniform(0.0, 0.15)
                await asyncio.sleep(backoff_seconds)

    raise RuntimeError("Unable to acquire lending database connection") from last_exc

async def init_db_pool():
    if not settings.database_url:
        logger.warning("DATABASE_URL is not set. Lending module DB operations will fail.")
        return
    try:
        await _ensure_pool()
    except Exception:
        # Keep API booting; requests will retry pool creation lazily.
        logger.exception("Initial lending DB pool creation failed. Will retry on request.")

async def close_db_pool():
    await _reset_pool()

async def get_db_connection() -> asyncpg.Pool:
    return await _ensure_pool()

# Dependency
async def get_db():
    pool: asyncpg.Pool | None = None
    conn: asyncpg.Connection | None = None
    try:
        pool, conn = await _acquire_connection_with_retry()
        yield conn
    except HTTPException:
        raise
    except Exception:
        logger.exception("Lending DB unavailable after retries")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Lending database is temporarily unavailable. Please retry in a few seconds.",
        )
    finally:
        if pool and conn:
            try:
                await pool.release(conn)
            except Exception:
                logger.warning("Failed to release lending DB connection; resetting pool")
                await _reset_pool()
