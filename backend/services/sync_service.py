import logging
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any

from config import CSV_FILE
from domain.activity_route import parse_gpx_route
from domain.sync_normalizers import (
    SUPPORTED_ACTIVITY_TYPES,
    clean_value as _clean_value,
    normalize_activity,
    normalize_activity_type,
    normalize_hr_zones,
    normalize_personal_records,
)
from services.activity_repository import latest_activity_start, upsert_activities
from services.activity_route_repository import (
    latest_activity_id,
    route_needs_sync,
    save_activity_route,
)
from services.database import connect
from services.hr_zone_repository import (
    activity_ids_missing_hr_zones,
    mark_activity_hr_zones_failed,
    replace_activity_hr_zones,
)
from services.personal_record_repository import replace_personal_records

LOGGER = logging.getLogger(__name__)
MAX_HR_ZONE_FETCHES_PER_SYNC = 20
SYNC_OVERLAP_DAYS = 7


def sync_csv(csv_path: Path | None = None, db_path: Path | None = None) -> dict[str, Any]:
    import pandas as pd

    path = Path(csv_path or CSV_FILE)
    if not path.exists():
        raise FileNotFoundError(f"CSV file '{path}' not found.")
    run_id = _start_run("csv", db_path)
    try:
        frame = pd.read_csv(path)
        raw_rows = frame.to_dict("records")
        normalized = [
            item
            for item in (normalize_activity(row) for row in raw_rows)
            if item and item["activity_type"] in SUPPORTED_ACTIVITY_TYPES
        ]
        counts = upsert_activities(normalized, db_path)
        counts["zones"] = 0
        imported_activity_ids = {activity["activity_id"] for activity in normalized}
        for raw in raw_rows:
            activity_id = _clean_value(raw.get("activityId"))
            zones = normalize_hr_zones(raw)
            if activity_id is not None and int(activity_id) in imported_activity_ids and zones:
                replace_activity_hr_zones(int(activity_id), zones, raw, db_path)
                counts["zones"] += 1
        return _finish_run(run_id, "success", counts, db_path=db_path)
    except Exception as error:
        _finish_run(run_id, "failed", error_message=str(error), db_path=db_path)
        raise


def sync_garmin(db_path: Path | None = None) -> dict[str, Any]:
    from infrastructure.client_garmin import get_client

    run_id = _start_run("garmin", db_path)
    try:
        client = get_client()
        refresh_cutoffs = {
            activity_type: (
                newest - timedelta(days=SYNC_OVERLAP_DAYS) if newest else None
            )
            for activity_type in SUPPORTED_ACTIVITY_TYPES
            for newest in [latest_activity_start(db_path, activity_type)]
        }
        reached_known_data = {
            activity_type: False for activity_type in SUPPORTED_ACTIVITY_TYPES
        }
        raw_activities = []
        start = 0
        limit = 100

        while True:
            page = client.get_activities(start, limit)
            if not page:
                break
            for raw in page:
                activity_type = normalize_activity_type(raw)
                if activity_type not in SUPPORTED_ACTIVITY_TYPES:
                    continue
                activity_time = datetime.fromisoformat(str(raw["startTimeLocal"]))
                refresh_cutoff = refresh_cutoffs[activity_type]
                if refresh_cutoff and activity_time < refresh_cutoff:
                    reached_known_data[activity_type] = True
                    continue
                raw_activities.append(raw)
            start += limit
            if all(
                refresh_cutoffs[activity_type] is not None
                and reached_known_data[activity_type]
                for activity_type in SUPPORTED_ACTIVITY_TYPES
            ):
                break

        normalized = [
            item
            for item in (normalize_activity(raw) for raw in raw_activities)
            if item and item["activity_type"] in SUPPORTED_ACTIVITY_TYPES
        ]
        counts = upsert_activities(normalized, db_path)
        counts["zones"] = 0
        for activity_type in ("running", "cycling"):
            _sync_latest_activity_route(client, activity_type, db_path)
        for activity_id in activity_ids_missing_hr_zones(
            MAX_HR_ZONE_FETCHES_PER_SYNC,
            db_path,
        ):
            try:
                raw_zones = client.get_activity_hr_in_timezones(str(activity_id))
                normalized_zones = normalize_hr_zones(raw_zones)
                replace_activity_hr_zones(
                    activity_id,
                    normalized_zones,
                    raw_zones,
                    db_path,
                )
                if normalized_zones:
                    counts["zones"] += 1
            except Exception as error:
                LOGGER.warning(
                    "Heart-rate zones unavailable for activity %s: %s",
                    activity_id,
                    error,
                )
                mark_activity_hr_zones_failed(activity_id, str(error), db_path)
        raw_personal_records = client.get_personal_record()
        replace_personal_records(
            normalize_personal_records(raw_personal_records),
            db_path,
        )
        return _finish_run(run_id, "success", counts, db_path=db_path)
    except Exception as error:
        _finish_run(run_id, "failed", error_message=str(error), db_path=db_path)
        raise


def _sync_latest_activity_route(
    client: Any,
    activity_type: str,
    db_path: Path | None = None,
) -> None:
    activity_id = latest_activity_id(activity_type, db_path)
    if activity_id is None or not route_needs_sync(activity_id, db_path):
        return
    try:
        raw_gpx = client.download_activity(
            str(activity_id),
            client.ActivityDownloadFormat.GPX,
        )
        points = parse_gpx_route(raw_gpx)
        if points:
            save_activity_route(activity_id, points, "success", db_path=db_path)
        else:
            save_activity_route(
                activity_id,
                [],
                "unavailable",
                "Garmin non ha restituito coordinate GPS per questa attività.",
                db_path,
            )
    except Exception as error:
        LOGGER.warning(
            "Route unavailable for latest %s activity %s: %s",
            activity_type,
            activity_id,
            error,
        )
        save_activity_route(
            activity_id,
            [],
            "failed",
            str(error),
            db_path,
        )


def list_sync_runs(limit: int = 20, db_path: Path | None = None) -> list[dict[str, Any]]:
    with connect(db_path) as connection:
        rows = connection.execute(
            "SELECT * FROM sync_runs ORDER BY id DESC LIMIT ?", (limit,)
        ).fetchall()
    return [dict(row) for row in rows]


def _start_run(source: str, db_path: Path | None) -> int:
    with connect(db_path) as connection:
        cursor = connection.execute(
            """
            INSERT INTO sync_runs (source, status, started_at)
            VALUES (?, 'running', ?)
            RETURNING id
            """,
            (source, datetime.now().isoformat(timespec="seconds")),
        )
        return int(cursor.fetchone()["id"])


def _finish_run(
    run_id: int,
    status: str,
    counts: dict[str, int] | None = None,
    error_message: str | None = None,
    db_path: Path | None = None,
) -> dict[str, Any]:
    counts = counts or {"inserted": 0, "updated": 0, "skipped": 0, "zones": 0}
    finished_at = datetime.now().isoformat(timespec="seconds")
    with connect(db_path) as connection:
        connection.execute(
            """
            UPDATE sync_runs SET status = ?, finished_at = ?, inserted_count = ?,
                updated_count = ?, skipped_count = ?, hr_zone_count = ?,
                error_message = ? WHERE id = ?
            """,
            (
                status,
                finished_at,
                counts["inserted"],
                counts["updated"],
                counts["skipped"],
                counts.get("zones", 0),
                error_message,
                run_id,
            ),
        )
        row = connection.execute("SELECT * FROM sync_runs WHERE id = ?", (run_id,)).fetchone()
    return dict(row)
