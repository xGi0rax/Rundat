import math
import sys
import tempfile
import unittest
from datetime import datetime
from pathlib import Path
from unittest.mock import patch

import pandas as pd

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

import data_processor
from schemas import ActivitySummary, DashboardSummary


class PaceTests(unittest.TestCase):
    def test_calculates_pace_from_metres_per_second(self):
        self.assertEqual(data_processor.calculate_pace(1000 / 300), "5:00")

    def test_rounding_carries_seconds_into_next_minute(self):
        self.assertEqual(data_processor.calculate_pace(1000 / 299.6), "5:00")

    def test_returns_none_for_missing_or_non_positive_speed(self):
        for speed in (None, 0, -1, math.nan):
            with self.subTest(speed=speed):
                self.assertIsNone(data_processor.calculate_pace(speed))

    def test_calculates_decimal_pace(self):
        self.assertEqual(data_processor.calc_pace_decimal(1000 / 330), 5.5)


class DashboardTests(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.csv_path = Path(self.temp_dir.name) / "activities.csv"
        pd.DataFrame(
            [
                {
                    "activityId": 2,
                    "activityName": "Recent run",
                    "startTimeLocal": "2026-07-20 08:00:00",
                    "distance": 5000,
                    "duration": 1500,
                    "averageSpeed": 5000 / 1500,
                    "averageHR": 150,
                    "maxHR": 170,
                    "calories": 350,
                    "elevationGain": 20,
                },
                {
                    "activityId": 1,
                    "activityName": "Older run",
                    "startTimeLocal": "2026-07-01 08:00:00",
                    "distance": 10000,
                    "duration": 3600,
                    "averageSpeed": 10000 / 3600,
                    "averageHR": 140,
                    "maxHR": 160,
                    "calories": 650,
                    "elevationGain": 40,
                },
            ]
        ).to_csv(self.csv_path, index=False)

    def tearDown(self):
        self.temp_dir.cleanup()

    def test_dashboard_aggregates_and_validates_against_api_model(self):
        with patch.object(data_processor, "CSV_FILE", self.csv_path):
            result = data_processor.get_dashboard_summary(datetime(2026, 7, 22, 12, 0))

        dashboard = DashboardSummary.model_validate(result)
        self.assertEqual(dashboard.total_activities, 2)
        self.assertEqual(dashboard.total_distance_km, 15)
        self.assertEqual(dashboard.last_7_days_distance_km, 5)
        self.assertEqual(dashboard.average_pace, "5:40")
        self.assertEqual(dashboard.latest_activity.activity_id, 2)

    def test_activity_contract_validates_real_csv_shape(self):
        with patch.object(data_processor, "CSV_FILE", self.csv_path):
            activities = data_processor.get_activity_summaries()

        validated = [ActivitySummary.model_validate(item) for item in activities]
        self.assertEqual([item.activity_id for item in validated], [2, 1])


if __name__ == "__main__":
    unittest.main()
