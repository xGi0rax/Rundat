from contextlib import asynccontextmanager
import logging
from threading import Lock

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

from config import CSV_FILE, get_cors_origins
from schemas import ActivitySummary, DashboardSummary, PersonalBest, PersonalBestHistory, SyncRun
from services.activity_repository import count_activities
from services.activity_service import (
    get_activities,
    get_dashboard,
    get_personal_best_history,
    get_personal_bests,
)
from services.database import initialize_database
from services.sync_service import list_sync_runs, sync_csv, sync_garmin

LOGGER = logging.getLogger(__name__)
SYNC_LOCK = Lock()


@asynccontextmanager
async def lifespan(_: FastAPI):
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


@app.get("/api/health")
def health_endpoint():
    return {"status": "ok"}


@app.get("/api/activities", response_model=list[ActivitySummary])
def activities_endpoint():
    return get_activities()


@app.get("/api/pbs", response_model=dict[str, PersonalBest])
def personal_bests_endpoint():
    return get_personal_bests()


@app.get("/api/pbs/history", response_model=list[PersonalBestHistory])
def personal_best_history_endpoint():
    return get_personal_best_history()


@app.get("/api/dashboard", response_model=DashboardSummary)
def dashboard_endpoint():
    return get_dashboard()


@app.post("/api/sync/csv", response_model=SyncRun)
def sync_csv_endpoint():
    if not SYNC_LOCK.acquire(blocking=False):
        raise HTTPException(status_code=409, detail="Una sincronizzazione è già in corso.")
    try:
        return sync_csv()
    except FileNotFoundError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error
    except Exception as error:
        LOGGER.exception("CSV synchronization failed")
        raise HTTPException(status_code=500, detail="Sincronizzazione CSV non riuscita.") from error
    finally:
        SYNC_LOCK.release()


@app.post("/api/sync/garmin", response_model=SyncRun)
def sync_garmin_endpoint():
    if not SYNC_LOCK.acquire(blocking=False):
        raise HTTPException(status_code=409, detail="Una sincronizzazione è già in corso.")
    try:
        return sync_garmin()
    except Exception as error:
        LOGGER.exception("Garmin synchronization failed")
        raise HTTPException(
            status_code=502,
            detail="Sincronizzazione Garmin non riuscita. Controlla i log del server.",
        ) from error
    finally:
        SYNC_LOCK.release()


@app.get("/api/sync/history", response_model=list[SyncRun])
def sync_history_endpoint(limit: int = Query(default=20, ge=1, le=100)):
    return list_sync_runs(limit)
