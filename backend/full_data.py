import logging

import pandas as pd

from config import CSV_FILE
from domain.sync_normalizers import SUPPORTED_ACTIVITY_TYPES, normalize_activity_type
from infrastructure.client_garmin import get_client
from infrastructure.garmin_utils import fetch_all_activities

LOGGER = logging.getLogger(__name__)


def fetch_full_datas():
    """Recupera l'operazione fetch full datas."""
    client = get_client()
    activities = fetch_all_activities(client)
    frame = pd.DataFrame(activities)
    supported = frame[
        frame["activityType"].apply(
            lambda activity_type: normalize_activity_type({"activityType": activity_type})
            in SUPPORTED_ACTIVITY_TYPES
        )
    ]
    supported.to_csv(CSV_FILE, index=False)
    LOGGER.info("Saved %s running and cycling activities to %s", len(supported), CSV_FILE)

if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    fetch_full_datas()
