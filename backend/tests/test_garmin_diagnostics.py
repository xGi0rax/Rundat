import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from services.database import initialize_database
from services.sync_service import diagnose_garmin_form


class FakeGarminClient:
    """Client Garmin minimo per verificare la raccolta diagnostica."""

    def get_training_readiness(self, date):
        return {"score": 72, "calendarDate": date}

    def get_training_status(self, date):
        return {}

    def get_hrv_data(self, date):
        raise RuntimeError("HRV non disponibile")

    def get_sleep_data(self, date):
        return {"sleepTimeSeconds": 25200}

    def get_stress_data(self, date):
        return None

    def get_body_battery(self, date):
        return {"charged": 80}

    def get_rhr_day(self, date):
        return {"restingHeartRate": 48}

    def get_max_metrics(self, date):
        return {"vo2Max": 52}

    def get_endurance_score(self, date):
        return {"score": 6400}


class GarminDiagnosticsTests(unittest.TestCase):
    def test_diagnostic_isolates_metric_errors_and_persists_payloads(self):
        """Verifica che una metrica assente non blocchi le altre."""
        with tempfile.TemporaryDirectory() as directory:
            db_path = Path(directory) / "rundat.db"
            initialize_database(db_path)
            with patch(
                "infrastructure.client_garmin.get_client",
                return_value=FakeGarminClient(),
            ):
                result = diagnose_garmin_form(days=1, db_path=db_path)

            by_metric = {item["metric"]: item for item in result["metrics"]}
            self.assertEqual(by_metric["trainingReadiness"]["status"], "available")
            self.assertEqual(by_metric["trainingStatus"]["status"], "empty")
            self.assertEqual(by_metric["hrv"]["status"], "error")
            self.assertEqual(by_metric["sleep"]["status"], "available")
            self.assertEqual(by_metric["maxMetrics"]["status"], "available")


if __name__ == "__main__":
    unittest.main()
