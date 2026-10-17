from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from api.routes import require_access_token, router
from config import CSV_FILE, get_cors_origins
from services.activity_repository import count_activities
from services.database import initialize_database
from services.sync_service import sync_csv


@asynccontextmanager
async def lifespan(_: FastAPI):
    """Gestisce l'operazione lifespan."""
    initialize_database()
    if count_activities() == 0 and CSV_FILE.exists():
        sync_csv()
    yield


app = FastAPI(title="Rundat API", version="2.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=get_cors_origins(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router)
