import logging
import os
import secrets
from threading import Lock

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from config import get_access_token
from schemas import (
    ActivityRoute,
    ActivitySummary,
    DashboardSummary,
    RacePrediction,
    SyncRun,
)
from services.activity_route_repository import get_activity_route
from services.activity_service import get_activities, get_dashboard
from services.database import connect
from services.race_prediction_repository import list_race_predictions
from services.sync_service import list_sync_runs, sync_csv, sync_garmin

LOGGER = logging.getLogger(__name__)
SYNC_LOCK = Lock()
BEARER_SCHEME = HTTPBearer(auto_error=False)
router = APIRouter(prefix="/api")


def require_access_token(
    credentials: HTTPAuthorizationCredentials | None = Depends(BEARER_SCHEME),
) -> None:
    """Rifiuta le richieste protette prive del bearer token configurato."""
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


@router.get("/health")
def health_endpoint():
    """Restituisce lo stato dell'API e se l'autenticazione è attiva."""
    return {"status": "ok", "authenticationRequired": bool(get_access_token())}


@router.get(
    "/activities",
    response_model=list[ActivitySummary],
    dependencies=[Depends(require_access_token)],
)
def activities_endpoint():
    """Restituisce tutte le attività normalizzate disponibili."""
    return get_activities()


@router.get(
    "/activities/{activity_id}/route",
    response_model=ActivityRoute,
    dependencies=[Depends(require_access_token)],
)
def activity_route_endpoint(activity_id: int):
    """Restituisce la traccia GPS associata all'attività richiesta."""
    try:
        return get_activity_route(activity_id)
    except LookupError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error


@router.get(
    "/dashboard",
    response_model=DashboardSummary,
    dependencies=[Depends(require_access_token)],
)
def dashboard_endpoint():
    """Restituisce i dati aggregati mostrati nella dashboard."""
    return get_dashboard()


@router.get(
    "/race-predictions",
    response_model=list[RacePrediction],
    dependencies=[Depends(require_access_token)],
)
def race_predictions_endpoint(
    granularity: str | None = Query(default=None, pattern="^(daily|monthly)$"),
):
    """Restituisce lo storico delle previsioni calcolate da Garmin."""
    return list_race_predictions(granularity)


@router.post(
    "/sync/csv",
    response_model=SyncRun,
    dependencies=[Depends(require_access_token)],
)
def sync_csv_endpoint():
    """Importa il CSV locale e restituisce il riepilogo della sincronizzazione."""
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


@router.post(
    "/sync/garmin",
    response_model=SyncRun,
    dependencies=[Depends(require_access_token)],
)
def sync_garmin_endpoint():
    """Scarica da Garmin le attività aggiornate e le salva nel database."""
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


@router.get(
    "/sync/history",
    response_model=list[SyncRun],
    dependencies=[Depends(require_access_token)],
)
def sync_history_endpoint(limit: int = Query(default=20, ge=1, le=100)):
    """Restituisce gli ultimi tentativi di sincronizzazione."""
    return list_sync_runs(limit)


@router.get("/cron/keep-alive")
def keep_alive():
    """Esegue una query minima per mantenere attiva la connessione al database."""
    try:
        with connect() as conn:
            conn.execute("SELECT 1;")
        return {"status": "ok", "db": "awake"}
    except Exception as error:
        LOGGER.exception("Keep-alive ping failed")
        raise HTTPException(
            status_code=500,
            detail=f"Ping al database fallito: {str(error)}",
        ) from error
