import logging
import os
import tempfile
from pathlib import Path

from dotenv import load_dotenv
from garminconnect import (
    Garmin,
    GarminConnectAuthenticationError,
    GarminConnectTooManyRequestsError,
)

from config import BACKEND_DIR
from services.database import uses_postgres
from services.garmin_token_repository import (
    restore_token_directory,
    save_token_directory,
)

LOGGER = logging.getLogger(__name__)

load_dotenv(BACKEND_DIR / ".env")
email = os.getenv("GARMIN_EMAIL")
password = os.getenv("GARMIN_PASSWORD")
token_dir = str(
    Path(
        os.getenv(
            "RUNDAT_GARMIN_TOKEN_DIR",
            Path(tempfile.gettempdir()) / "rundat-garmin"
            if os.getenv("VERCEL")
            else BACKEND_DIR / ".garminconnect",
        )
    )
)


def get_client():
    """Restituisce l'operazione get client."""
    os.makedirs(token_dir, exist_ok=True)
    if uses_postgres():
        try:
            restore_token_directory(Path(token_dir))
        except Exception as error:
            LOGGER.warning("Stored Garmin tokens could not be restored: %s", error)

    try:
        client = Garmin()
        client.login(token_dir)
        _persist_remote_tokens()
        LOGGER.info("Garmin session restored")
        return client
    except Exception as error:
        LOGGER.info("Stored Garmin session unavailable: %s", error)

    if not email or not password:
        raise RuntimeError(
            "Credenziali Garmin mancanti: configura GARMIN_EMAIL e GARMIN_PASSWORD."
        )

    try:
        client = Garmin(email=email, password=password)
        client.login()
        client.client.dump(token_dir)
        _persist_remote_tokens()
        LOGGER.info("Garmin login successful; session saved")
        return client
    except GarminConnectTooManyRequestsError as e:
        raise RuntimeError(
            "Garmin ha temporaneamente limitato i tentativi di accesso. "
            "Attendi almeno un'ora prima di riprovare."
        ) from e
    except GarminConnectAuthenticationError as e:
        raise RuntimeError(f"Garmin authentication error: {e}") from e
    except Exception as e:
        raise RuntimeError(f"Garmin connection error: {e}") from e


def _persist_remote_tokens() -> None:
    """Gestisce l'operazione persist remote tokens."""
    if uses_postgres():
        save_token_directory(Path(token_dir))
