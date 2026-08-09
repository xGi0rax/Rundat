import sys
import tempfile
import unittest
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from domain.activity_route import parse_gpx_route
from domain.sync_normalizers import normalize_activity
from schemas import ActivityRoute
from services.activity_repository import upsert_activities
from services.activity_route_repository import (
    get_activity_route,
    route_needs_sync,
    save_activity_route,
)
from services.database import initialize_database
from services.sync_service import _sync_latest_activity_route


GPX = b"""<?xml version="1.0" encoding="UTF-8"?>
<gpx xmlns="http://www.topografix.com/GPX/1/1">
  <trk><trkseg>
    <trkpt lat="45.100001" lon="9.100001"><ele>120.4</ele></trkpt>
    <trkpt lat="45.100500" lon="9.101000"><ele>122.0</ele></trkpt>
    <trkpt lat="45.101000" lon="9.102000"><ele>125.1</ele></trkpt>
  </trkseg></trk>
</gpx>"""


class ActivityRouteTests(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.db_path = Path(self.temp_dir.name) / "rundat.db"
        initialize_database(self.db_path)
        activity = normalize_activity(
            {
                "activityId": 501,
                "activityName": "Morning run",
                "activityType": "running",
                "startTimeLocal": "2026-08-08T08:00:00",
                "distance": 5000,
                "duration": 1500,
            }
        )
        upsert_activities([activity], self.db_path)

    def tearDown(self):
        self.temp_dir.cleanup()

    def test_gpx_points_are_parsed_and_reduced_with_endpoints_preserved(self):
        points = parse_gpx_route(GPX, max_points=2)

        self.assertEqual(len(points), 2)
        self.assertEqual(points[0]["latitude"], 45.100001)
        self.assertEqual(points[-1]["longitude"], 9.102)
        self.assertEqual(points[0]["elevation"], 120.4)

    def test_route_repository_exposes_pending_and_persisted_routes(self):
        pending = get_activity_route(501, self.db_path)
        self.assertEqual(pending["status"], "pending")
        self.assertTrue(route_needs_sync(501, self.db_path))

        points = parse_gpx_route(GPX)
        save_activity_route(501, points, "success", db_path=self.db_path)
        route = get_activity_route(501, self.db_path)

        self.assertEqual(route["status"], "success")
        self.assertEqual(route["pointCount"], 3)
        self.assertFalse(route_needs_sync(501, self.db_path))
        ActivityRoute.model_validate(route)

    def test_latest_cycling_route_is_downloaded_and_persisted(self):
        cycling_activity = normalize_activity(
            {
                "activityId": 502,
                "activityName": "Evening ride",
                "activityType": "cycling",
                "startTimeLocal": "2026-08-09T18:00:00",
                "distance": 25000,
                "duration": 3600,
            }
        )
        upsert_activities([cycling_activity], self.db_path)

        class FakeFormat:
            GPX = "gpx"

        class FakeClient:
            ActivityDownloadFormat = FakeFormat

            def __init__(self):
                self.downloaded = []

            def download_activity(self, activity_id, download_format):
                self.downloaded.append((activity_id, download_format))
                return GPX

        client = FakeClient()
        _sync_latest_activity_route(client, "cycling", self.db_path)

        self.assertEqual(client.downloaded, [("502", "gpx")])
        self.assertEqual(get_activity_route(502, self.db_path)["status"], "success")


if __name__ == "__main__":
    unittest.main()
