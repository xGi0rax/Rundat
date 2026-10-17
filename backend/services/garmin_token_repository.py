import base64
import json
from datetime import datetime
from pathlib import Path, PurePosixPath

from services.database import connect

STORE_KEY = "garmin-connect"


def load_token_bundle() -> dict[str, bytes]:
    """Carica l'operazione load token bundle."""
    with connect() as connection:
        row = connection.execute(
            "SELECT token_bundle FROM garmin_token_store WHERE store_key = ?",
            (STORE_KEY,),
        ).fetchone()
    if not row:
        return {}

    encoded_files = json.loads(row["token_bundle"])
    return {
        _safe_relative_name(name): base64.b64decode(contents)
        for name, contents in encoded_files.items()
    }


def save_token_directory(token_directory: Path) -> None:
    """Salva l'operazione save token directory."""
    encoded_files = {
        file.relative_to(token_directory).as_posix(): base64.b64encode(
            file.read_bytes()
        ).decode("ascii")
        for file in token_directory.rglob("*")
        if file.is_file()
    }
    if not encoded_files:
        raise RuntimeError("Garmin non ha prodotto token di sessione persistibili.")

    payload = json.dumps(encoded_files, sort_keys=True, separators=(",", ":"))
    with connect() as connection:
        connection.execute(
            """
            INSERT INTO garmin_token_store (store_key, token_bundle, updated_at)
            VALUES (?, ?, ?)
            ON CONFLICT (store_key) DO UPDATE SET
                token_bundle = excluded.token_bundle,
                updated_at = excluded.updated_at
            """,
            (
                STORE_KEY,
                payload,
                datetime.now().isoformat(timespec="seconds"),
            ),
        )


def restore_token_directory(token_directory: Path) -> bool:
    """Gestisce l'operazione restore token directory."""
    files = load_token_bundle()
    if not files:
        return False
    token_directory.mkdir(parents=True, exist_ok=True)
    for relative_name, contents in files.items():
        destination = token_directory / Path(relative_name)
        destination.parent.mkdir(parents=True, exist_ok=True)
        destination.write_bytes(contents)
    return True


def _safe_relative_name(value: str) -> str:
    """Gestisce l'operazione safe relative name."""
    path = PurePosixPath(value)
    if path.is_absolute() or ".." in path.parts or not path.parts:
        raise ValueError("Nome file token Garmin non valido.")
    return path.as_posix()
