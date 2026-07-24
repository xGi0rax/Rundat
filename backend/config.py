import os
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent
CSV_FILE = BACKEND_DIR / "running_activities_FULL.csv"
DEFAULT_DB_FILE = BACKEND_DIR / "rundat.db"
DEFAULT_CORS_ORIGINS = (
    "http://localhost:5173",
    "http://127.0.0.1:5173",
)


def get_cors_origins() -> list[str]:
    configured = os.getenv("RUNDAT_CORS_ORIGINS")
    if not configured:
        return list(DEFAULT_CORS_ORIGINS)
    return [origin.strip() for origin in configured.split(",") if origin.strip()]


def get_db_path() -> Path:
    return Path(os.getenv("RUNDAT_DB_PATH", DEFAULT_DB_FILE)).expanduser().resolve()
