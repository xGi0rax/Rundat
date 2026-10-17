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
from services.sync_service import (
    list_sync_runs,
    normalize_activity,
    normalize_hr_zones,
    sync_csv,
)


class DatabaseSyncTests(unittest.TestCase):
    def setUp(self):
        """Gestisce l'operazione setUp."""
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
        """Gestisce l'operazione tearDown."""
        self.temp_dir.cleanup()

    def test_csv_import_is_idempotent_and_records_history(self):
        """Verifica l'operazione test csv import is idempotent and records history."""
        first = sync_csv(self.csv_path, self.db_path)
        second = sync_csv(self.csv_path, self.db_path)

        self.assertEqual(first["inserted_count"], 2)
        self.assertEqual(second["inserted_count"], 0)
        self.assertEqual(second["skipped_count"], 2)
        self.assertEqual(count_activities(self.db_path), 2)
        self.assertEqual(len(list_sync_runs(db_path=self.db_path)), 2)
        SyncRun.model_validate(second)

    def test_existing_activity_is_updated_by_activity_id(self):
        """Verifica l'operazione test existing activity is updated by activity id."""
        sync_csv(self.csv_path, self.db_path)
        self.rows[0]["activityName"] = "Updated name"
        pd.DataFrame(self.rows).to_csv(self.csv_path, index=False)

        result = sync_csv(self.csv_path, self.db_path)
        activities = get_activities(self.db_path)

        self.assertEqual(result["updated_count"], 1)
        self.assertEqual(result["skipped_count"], 1)
        self.assertEqual(count_activities(self.db_path), 2)
        self.assertEqual(activities[0]["activityName"], "Updated name")

    def test_csv_and_garmin_zone_shapes_are_normalized_and_persisted(self):
        """Verifica l'operazione test csv and garmin zone shapes are normalized and persisted."""
        self.rows[0].update(
            {
                "hrTimeInZone_1": 120,
                "hrTimeInZone_2": 600,
                "hrTimeInZone_3": 480,
                "hrTimeInZone_4": 240,
                "hrTimeInZone_5": 60,
            }
        )
        pd.DataFrame(self.rows).to_csv(self.csv_path, index=False)
        sync_csv(self.csv_path, self.db_path)

        latest = get_activities(self.db_path)[0]
        self.assertEqual(len(latest["heartRateZones"]), 5)
        self.assertEqual(latest["heartRateZones"][1]["seconds"], 600)
        self.assertEqual(latest["heartRateZones"][1]["percentage"], 40)

        garmin_zones = normalize_hr_zones(
            [
                {"zoneNumber": 1, "secsInZone": 90, "zoneLowBoundary": 95},
                {"zoneNumber": 2, "secsInZone": 300, "zoneLowBoundary": 120},
            ]
        )
        self.assertEqual(garmin_zones[0]["high_bpm"], 120)
        self.assertEqual(garmin_zones[1]["seconds"], 300)

    def test_invalid_numbers_are_rejected_without_crashing_normalization(self):
        """Verifica l'operazione test invalid numbers are rejected without crashing normalization."""
        malformed = {**self.rows[0], "distance": "not-a-number"}
        self.assertIsNone(normalize_activity(malformed))

        zones = normalize_hr_zones(
            [
                {"zoneNumber": 1, "secsInZone": "invalid"},
                {"zoneNumber": 2, "secsInZone": 120, "lowBpm": "invalid"},
            ]
        )
        self.assertEqual(zones, [{
            "zone_number": 2,
            "seconds": 120,
            "low_bpm": None,
            "high_bpm": None,
        }])

    def test_running_and_cycling_types_are_normalized_and_persisted(self):
        """Verifica l'operazione test running and cycling types are normalized and persisted."""
        self.rows[0]["activityType"] = {"typeKey": "running"}
        self.rows[1]["activityType"] = {"typeKey": "cycling"}
        pd.DataFrame(self.rows).to_csv(self.csv_path, index=False)

        sync_csv(self.csv_path, self.db_path)
        activities = get_activities(self.db_path)

        self.assertEqual(
            {activity["activityType"] for activity in activities},
            {"running", "cycling"},
        )
        dashboard = DashboardSummary.model_validate(
            get_dashboard(datetime(2026, 7, 22, 12, 0), self.db_path)
        )
        self.assertEqual(dashboard.total_activities, 1)
        self.assertEqual(dashboard.latest_activity.activity_type, "running")

    def test_dashboard_contract_is_preserved_after_migration(self):
        """Verifica l'operazione test dashboard contract is preserved after migration."""
        sync_csv(self.csv_path, self.db_path)
        result = get_dashboard(datetime(2026, 7, 22, 12, 0), self.db_path)
        dashboard = DashboardSummary.model_validate(result)

        self.assertEqual(dashboard.total_activities, 2)
        self.assertEqual(dashboard.total_distance_km, 15)
        self.assertEqual(dashboard.last_7_days_distance_km, 5)
        self.assertEqual(dashboard.latest_activity.activity_id, 101)

if __name__ == "__main__":
    unittest.main()
