import math
from datetime import datetime
from pathlib import Path
from typing import Any

import pandas as pd

from data_processor import CSV_FILE
from services.activity_repository import encode_raw_data, latest_activity_start, upsert_activities
from services.database import connect


def _clean_value(value: Any):
    if value is None:
        return None
    try:
        if pd.isna(value):
            return None
    except (TypeError, ValueError):
        pass
    if hasattr(value, "item"):
        value = value.item()
    if isinstance(value, float) and not math.isfinite(value):
        return None
    return value


def normalize_activity(raw: dict[str, Any]) -> dict[str, Any] | None:
    activity_id = _clean_value(raw.get("activityId"))
    start_time = _clean_value(raw.get("startTimeLocal"))
    distance = _clean_value(raw.get("distance"))
    duration = _clean_value(raw.get("duration"))
    if activity_id is None or start_time is None or distance is None or duration is None:
        return None

    if isinstance(start_time, pd.Timestamp):
        start_time = start_time.to_pydatetime()
    if not isinstance(start_time, datetime):
        start_time = datetime.fromisoformat(str(start_time))

    cleaned_raw = {key: _clean_value(value) for key, value in raw.items()}
    cleaned_raw["startTimeLocal"] = start_time.isoformat(timespec="seconds")
    return {
        "activity_id": int(activity_id),
        "activity_name": _clean_value(raw.get("activityName")),
        "start_time_local": start_time.isoformat(timespec="seconds"),
        "distance": float(distance),
        "duration": float(duration),
        "average_speed": _float_or_none(raw.get("averageSpeed")),
        "average_hr": _float_or_none(raw.get("averageHR")),
        "max_hr": _float_or_none(raw.get("maxHR")),
        "calories": _float_or_none(raw.get("calories")),
        "elevation_gain": _float_or_none(raw.get("elevationGain")),
        "raw_data": encode_raw_data(cleaned_raw),
    }


def _float_or_none(value: Any) -> float | None:
    value = _clean_value(value)
    return None if value is None else float(value)


def sync_csv(csv_path: Path | None = None, db_path: Path | None = None) -> dict[str, Any]:
    path = Path(csv_path or CSV_FILE)
    if not path.exists():
        raise FileNotFoundError(f"CSV file '{path}' not found.")
    run_id = _start_run("csv", db_path)
    try:
        frame = pd.read_csv(path)
        normalized = [item for item in (normalize_activity(row) for row in frame.to_dict("records")) if item]
        counts = upsert_activities(normalized, db_path)
        return _finish_run(run_id, "success", counts, db_path=db_path)
    except Exception as error:
        _finish_run(run_id, "failed", error_message=str(error), db_path=db_path)
        raise


def sync_garmin(db_path: Path | None = None) -> dict[str, Any]:
    from infrastructure.client_garmin import get_client

    run_id = _start_run("garmin", db_path)
    try:
        client = get_client()
        newest_known = latest_activity_start(db_path)
        raw_activities = []
        start = 0
        limit = 100
        reached_known_data = False

        while not reached_known_data:
            page = client.get_activities(start, limit)
            if not page:
                break
            for raw in page:
                activity_type = raw.get("activityType") or {}
                if activity_type.get("typeKey") != "running":
                    continue
                activity_time = datetime.fromisoformat(str(raw["startTimeLocal"]))
                if newest_known and activity_time < newest_known:
                    reached_known_data = True
                    break
                raw_activities.append(raw)
            start += limit

        normalized = [item for item in (normalize_activity(raw) for raw in raw_activities) if item]
        counts = upsert_activities(normalized, db_path)
        return _finish_run(run_id, "success", counts, db_path=db_path)
    except Exception as error:
        _finish_run(run_id, "failed", error_message=str(error), db_path=db_path)
        raise


def list_sync_runs(limit: int = 20, db_path: Path | None = None) -> list[dict[str, Any]]:
    with connect(db_path) as connection:
        rows = connection.execute(
            "SELECT * FROM sync_runs ORDER BY id DESC LIMIT ?", (limit,)
        ).fetchall()
    return [dict(row) for row in rows]


def _start_run(source: str, db_path: Path | None) -> int:
    with connect(db_path) as connection:
        cursor = connection.execute(
            "INSERT INTO sync_runs (source, status, started_at) VALUES (?, 'running', ?)",
            (source, datetime.now().isoformat(timespec="seconds")),
        )
        return int(cursor.lastrowid)


def _finish_run(
    run_id: int,
    status: str,
    counts: dict[str, int] | None = None,
    error_message: str | None = None,
    db_path: Path | None = None,
) -> dict[str, Any]:
    counts = counts or {"inserted": 0, "updated": 0, "skipped": 0}
    finished_at = datetime.now().isoformat(timespec="seconds")
    with connect(db_path) as connection:
        connection.execute(
            """
            UPDATE sync_runs SET status = ?, finished_at = ?, inserted_count = ?,
                updated_count = ?, skipped_count = ?, error_message = ? WHERE id = ?
            """,
            (status, finished_at, counts["inserted"], counts["updated"], counts["skipped"], error_message, run_id),
        )
        row = connection.execute("SELECT * FROM sync_runs WHERE id = ?", (run_id,)).fetchone()
    return dict(row)
