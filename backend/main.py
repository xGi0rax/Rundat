from contextlib import asynccontextmanager
import logging
import os
import secrets
from threading import Lock

from fastapi import Depends, FastAPI, HTTPException, Query, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from config import CSV_FILE, get_access_token, get_cors_origins
from schemas import (
    ActivityRoute,
    ActivitySummary,
    DashboardSummary,
    PersonalBest,
    PersonalBestHistory,
    SyncRun,
)
from services.activity_repository import count_activities
from services.activity_route_repository import get_activity_route
from services.activity_service import (
    get_activities,
    get_dashboard,
    get_personal_best_history,
    get_personal_bests,
)
from services.database import initialize_database, connect
from services.sync_service import list_sync_runs, sync_csv, sync_garmin

LOGGER = logging.getLogger(__name__)
SYNC_LOCK = Lock()
BEARER_SCHEME = HTTPBearer(auto_error=False)


def require_access_token(
    credentials: HTTPAuthorizationCredentials | None = Depends(BEARER_SCHEME),
) -> None:
    expected = get_access_token()
    if not expected:
        if os.getenv("VERCEL"):
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="RUNDAT_ACCESS_TOKEN non è configurato.",
            )
        return
    if (
        credentials is None
        or credentials.scheme.lower() != "bearer"
        or not secrets.compare_digest(credentials.credentials, expected)
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Codice di accesso non valido.",
            headers={"WWW-Authenticate": "Bearer"},
        )


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
    return {"status": "ok", "authenticationRequired": bool(get_access_token())}


@app.get(
    "/api/activities",
    response_model=list[ActivitySummary],
    dependencies=[Depends(require_access_token)],
)
def activities_endpoint():
    return get_activities()


@app.get(
    "/api/activities/{activity_id}/route",
    response_model=ActivityRoute,
    dependencies=[Depends(require_access_token)],
)
def activity_route_endpoint(activity_id: int):
    try:
        return get_activity_route(activity_id)
    except LookupError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error


@app.get(
    "/api/pbs",
    response_model=dict[str, PersonalBest],
    dependencies=[Depends(require_access_token)],
)
def personal_bests_endpoint():
    return get_personal_bests()


@app.get(
    "/api/pbs/history",
    response_model=list[PersonalBestHistory],
    dependencies=[Depends(require_access_token)],
)
def personal_best_history_endpoint():
    return get_personal_best_history()


@app.get(
    "/api/dashboard",
    response_model=DashboardSummary,
    dependencies=[Depends(require_access_token)],
)
def dashboard_endpoint():
    return get_dashboard()


@app.post(
    "/api/sync/csv",
    response_model=SyncRun,
    dependencies=[Depends(require_access_token)],
)
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


@app.post(
    "/api/sync/garmin",
    response_model=SyncRun,
    dependencies=[Depends(require_access_token)],
)
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


@app.get(
    "/api/sync/history",
    response_model=list[SyncRun],
    dependencies=[Depends(require_access_token)],
)
def sync_history_endpoint(limit: int = Query(default=20, ge=1, le=100)):
    return list_sync_runs(limit)


@app.get("/api/cron/keep-alive", dependencies=[],)
def keep_alive():
    try:
        # Esempio generico basato sulla tua struttura: esegui un SELECT 1 o leggi 1 riga
        with connect() as conn:
            conn.execute("SELECT 1;")
        return {"status": "ok", "db": "awake"}
    except Exception as error:
        LOGGER.exception("Keep-alive ping failed")
        raise HTTPException(
            status_code=500, 
            detail=f"Ping al database fallito: {str(error)}"
        ) from error