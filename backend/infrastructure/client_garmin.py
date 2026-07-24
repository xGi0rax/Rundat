import logging
import os

from dotenv import load_dotenv
from garminconnect import (
    Garmin,
    GarminConnectAuthenticationError,
    GarminConnectTooManyRequestsError,
)

from config import BACKEND_DIR

LOGGER = logging.getLogger(__name__)

load_dotenv(BACKEND_DIR / ".env")
email = os.getenv("GARMIN_EMAIL")
password = os.getenv("GARMIN_PASSWORD")
token_dir = str(BACKEND_DIR / ".garminconnect")


def get_client():
    os.makedirs(token_dir, exist_ok=True)

    try:
        client = Garmin()
        client.login(token_dir)
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
