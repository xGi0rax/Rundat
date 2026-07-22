import sys
import tempfile
import unittest
from datetime import datetime
from pathlib import Path

import pandas as pd

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from schemas import DashboardSummary, SyncRun
from services.activity_repository import count_activities
from services.activity_service import get_activities, get_dashboard
from services.database import initialize_database
from services.sync_service import list_sync_runs, sync_csv


class DatabaseSyncTests(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.db_path = Path(self.temp_dir.name) / "rundat.db"
        self.csv_path = Path(self.temp_dir.name) / "activities.csv"
        self.rows = [
            {
                "activityId": 101,
                "activityName": "Five kilometres",
                "startTimeLocal": "2026-07-20 08:00:00",
                "distance": 5000,
                "duration": 1500,
                "averageSpeed": 5000 / 1500,
                "averageHR": 150,
            },
            {
                "activityId": 102,
                "activityName": "Ten kilometres",
                "startTimeLocal": "2026-07-01 08:00:00",
                "distance": 10000,
                "duration": 3600,
                "averageSpeed": 10000 / 3600,
                "averageHR": 140,
            },
        ]
        pd.DataFrame(self.rows).to_csv(self.csv_path, index=False)
        initialize_database(self.db_path)

    def tearDown(self):
        self.temp_dir.cleanup()

    def test_csv_import_is_idempotent_and_records_history(self):
        first = sync_csv(self.csv_path, self.db_path)
        second = sync_csv(self.csv_path, self.db_path)

        self.assertEqual(first["inserted_count"], 2)
        self.assertEqual(second["inserted_count"], 0)
        self.assertEqual(second["skipped_count"], 2)
        self.assertEqual(count_activities(self.db_path), 2)
        self.assertEqual(len(list_sync_runs(db_path=self.db_path)), 2)
        SyncRun.model_validate(second)

    def test_existing_activity_is_updated_by_activity_id(self):
        sync_csv(self.csv_path, self.db_path)
        self.rows[0]["activityName"] = "Updated name"
        pd.DataFrame(self.rows).to_csv(self.csv_path, index=False)

        result = sync_csv(self.csv_path, self.db_path)
        activities = get_activities(self.db_path)

        self.assertEqual(result["updated_count"], 1)
        self.assertEqual(result["skipped_count"], 1)
        self.assertEqual(count_activities(self.db_path), 2)
        self.assertEqual(activities[0]["activityName"], "Updated name")

    def test_dashboard_contract_is_preserved_after_migration(self):
        sync_csv(self.csv_path, self.db_path)
        result = get_dashboard(datetime(2026, 7, 22, 12, 0), self.db_path)
        dashboard = DashboardSummary.model_validate(result)

        self.assertEqual(dashboard.total_activities, 2)
        self.assertEqual(dashboard.total_distance_km, 15)
        self.assertEqual(dashboard.last_7_days_distance_km, 5)
        self.assertEqual(dashboard.latest_activity.activity_id, 101)


if __name__ == "__main__":
    unittest.main()
