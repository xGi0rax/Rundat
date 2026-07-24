import logging

import pandas as pd

from config import CSV_FILE
from infrastructure.client_garmin import get_client
from infrastructure.garmin_utils import fetch_all_activities

LOGGER = logging.getLogger(__name__)


def fetch_full_datas():
    client = get_client()
    activities = fetch_all_activities(client)
    frame = pd.DataFrame(activities)
    running = frame[
        frame["activityType"].apply(
            lambda activity_type: activity_type.get("typeKey") == "running"
        )
    ]
    running.to_csv(CSV_FILE, index=False)
    LOGGER.info("Saved %s running activities to %s", len(running), CSV_FILE)

if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    fetch_full_datas()
