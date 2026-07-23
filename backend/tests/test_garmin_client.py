import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import MagicMock, patch

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from infrastructure import client_garmin


class GarminClientTests(unittest.TestCase):
    def test_fresh_login_does_not_reload_stale_token(self):
        stored_session = MagicMock()
        stored_session.login.side_effect = RuntimeError("stale token")
        fresh_session = MagicMock()

        with tempfile.TemporaryDirectory() as temp_dir, \
             patch.object(client_garmin, "token_dir", temp_dir), \
             patch.object(client_garmin, "Garmin", side_effect=[stored_session, fresh_session]):
            result = client_garmin.get_client()

        self.assertIs(result, fresh_session)
        stored_session.login.assert_called_once_with(temp_dir)
        fresh_session.login.assert_called_once_with()
        fresh_session.client.dump.assert_called_once_with(temp_dir)


if __name__ == "__main__":
    unittest.main()
