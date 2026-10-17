import os
import sys
import unittest
from pathlib import Path
from unittest.mock import patch

from fastapi import HTTPException
from fastapi.security import HTTPAuthorizationCredentials

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from main import require_access_token


class ApiSecurityTests(unittest.TestCase):
    def test_local_development_allows_missing_access_token(self):
        """Verifica l'operazione test local development allows missing access token."""
        with patch.dict(os.environ, {}, clear=True):
            self.assertIsNone(require_access_token(None))

    def test_configured_access_token_is_compared_as_bearer(self):
        """Verifica l'operazione test configured access token is compared as bearer."""
        credentials = HTTPAuthorizationCredentials(
            scheme="Bearer",
            credentials="correct-token",
        )
        with patch.dict(
            os.environ,
            {"RUNDAT_ACCESS_TOKEN": "correct-token"},
            clear=True,
        ):
            self.assertIsNone(require_access_token(credentials))

    def test_invalid_access_token_is_rejected(self):
        """Verifica l'operazione test invalid access token is rejected."""
        credentials = HTTPAuthorizationCredentials(
            scheme="Bearer",
            credentials="wrong-token",
        )
        with patch.dict(
            os.environ,
            {"RUNDAT_ACCESS_TOKEN": "correct-token"},
            clear=True,
        ):
            with self.assertRaises(HTTPException) as context:
                require_access_token(credentials)
        self.assertEqual(context.exception.status_code, 401)


if __name__ == "__main__":
    unittest.main()
