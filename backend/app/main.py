from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import auth, contacts, ledger
from app.lending.routes import router as lending_router

from app.config import get_settings
from contextlib import asynccontextmanager

@asynccontextmanager
async def lifespan(app: FastAPI):
    from app.lending.database import init_db_pool, close_db_pool
    await init_db_pool()
    yield
    await close_db_pool()


settings = get_settings()

app = FastAPI(title="Ledgerly API", version="0.1.0", lifespan=lifespan)
ORIGINS = ['http://localhost:5173',
    settings.frontend_url
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(contacts.router)
app.include_router(ledger.router)
app.include_router(lending_router)


@app.get("/health")
async def health_check():
    return {"status": "ok"}
