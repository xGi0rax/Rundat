import os
import sys
from dotenv import load_dotenv
from pathlib import Path
from garminconnect import (
    Garmin,
    GarminConnectAuthenticationError,
    GarminConnectConnectionError,
    GarminConnectTooManyRequestsError,
)

# Credentials loading from .env or default token path
load_dotenv()
email = os.getenv("GARMIN_EMAIL")
password = os.getenv("GARMIN_PASSWORD")
token_dir = str(Path(__file__).parent.parent / ".garminconnect")

# Function to get Garmin client with token management
def get_client():
    os.makedirs(token_dir, exist_ok=True)

    # First try to restore session from saved tokens
    try:
        client = Garmin()
        client.login(token_dir)
        print("✅ Session restored!")
        return client
    except (GarminConnectAuthenticationError, GarminConnectConnectionError, Exception):
        print("No valid tokens found, executing full login...")

    # If token restore fails, execution of a full login with credentials
    try:
        client = Garmin(email=email, password=password)
        client.login(token_dir)                   
        print("✅ Login OK, tokens saved")
        return client
    except GarminConnectTooManyRequestsError:
        print("🚫 429. Wait at least 1 hour.")
        sys.exit(1)
    except GarminConnectAuthenticationError as e:
        print(f"❌ Authentication error: {e}")
        sys.exit(1)
    except Exception as e:
        print(f"❌ Error: {e}")
        sys.exit(1)


if __name__ == "__main__":
    get_client()