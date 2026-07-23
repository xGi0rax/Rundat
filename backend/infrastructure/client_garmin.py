import os
from pathlib import Path
from dotenv import load_dotenv
from garminconnect import (
    Garmin,
    GarminConnectAuthenticationError,
    GarminConnectConnectionError,
    GarminConnectTooManyRequestsError,
)

# Credentials and tokens are stored inside backend, regardless of the current
# working directory used to start Uvicorn.
BACKEND_DIR = Path(__file__).resolve().parents[1]
load_dotenv(BACKEND_DIR / ".env")
email = os.getenv("GARMIN_EMAIL")
password = os.getenv("GARMIN_PASSWORD")
token_dir = str(BACKEND_DIR / ".garminconnect")

# Function to get Garmin client with token management
def get_client():
    os.makedirs(token_dir, exist_ok=True)

    # First try to restore session from saved tokens
    try:
        client = Garmin()
        client.login(token_dir)
        print("Garmin session restored.")
        return client
    except Exception:
        print("No valid tokens found, executing full login...")

    # If token restore fails, execution of a full login with credentials
    try:
        client = Garmin(email=email, password=password)
        # Do not pass token_dir here: Garmin.login() prioritizes an existing
        # token file even when credentials are present. A stale token would
        # therefore be loaded a second time instead of performing a fresh
        # credential login.
        client.login()
        client.client.dump(token_dir)
        print("Garmin login successful; tokens saved.")
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
