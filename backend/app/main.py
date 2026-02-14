from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import auth, contacts, ledger

from app.config import get_settings

settings = get_settings()

app = FastAPI(title="Ledgerly API", version="0.1.0")
ORIGINS = [
    settings.frontend_url
]
print(ORIGINS)
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


@app.get("/health")
async def health_check():
    return {"status": "ok"}
