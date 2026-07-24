import json
from datetime import datetime
from pathlib import Path
from typing import Any, Iterable

from domain.activity_metrics import calc_pace_decimal, calculate_pace
from services.database import connect
from services.hr_zone_repository import list_hr_zones_by_activity

ACTIVITY_COLUMNS = (
    "activity_id",
    "activity_name",
    "start_time_local",
    "distance",
    "duration",
    "average_speed",
    "average_hr",
    "max_hr",
    "calories",
    "elevation_gain",
    "raw_data",
)


def count_activities(db_path: Path | None = None) -> int:
    with connect(db_path) as connection:
        return int(connection.execute("SELECT COUNT(*) FROM activities").fetchone()[0])


def upsert_activities(activities: Iterable[dict[str, Any]], db_path: Path | None = None) -> dict[str, int]:
    counts = {"inserted": 0, "updated": 0, "skipped": 0}
    now = datetime.now().isoformat(timespec="seconds")

    with connect(db_path) as connection:
        for activity in activities:
            values = tuple(activity[column] for column in ACTIVITY_COLUMNS)
            existing = connection.execute(
                "SELECT activity_name, start_time_local, distance, duration, average_speed, "
                "average_hr, max_hr, calories, elevation_gain, raw_data "
                "FROM activities WHERE activity_id = ?",
                (activity["activity_id"],),
            ).fetchone()

            comparable = values[1:]
            if existing is not None and tuple(existing) == comparable:
                counts["skipped"] += 1
                continue

            connection.execute(
                """
                INSERT INTO activities (
                    activity_id, activity_name, start_time_local, distance, duration,
                    average_speed, average_hr, max_hr, calories, elevation_gain,
                    raw_data, synced_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(activity_id) DO UPDATE SET
                    activity_name = excluded.activity_name,
                    start_time_local = excluded.start_time_local,
                    distance = excluded.distance,
                    duration = excluded.duration,
                    average_speed = excluded.average_speed,
                    average_hr = excluded.average_hr,
                    max_hr = excluded.max_hr,
                    calories = excluded.calories,
                    elevation_gain = excluded.elevation_gain,
                    raw_data = excluded.raw_data,
                    synced_at = excluded.synced_at
                """,
                (*values, now),
            )
            counts["updated" if existing is not None else "inserted"] += 1

    return counts


def list_activities(db_path: Path | None = None) -> list[dict[str, Any]]:
    with connect(db_path) as connection:
        rows = connection.execute(
            """
            SELECT activity_id, activity_name, start_time_local, distance, duration,
                   average_speed, average_hr, max_hr, calories, elevation_gain
            FROM activities
            WHERE distance >= 1000
            ORDER BY start_time_local DESC
            """
        ).fetchall()
    zones_by_activity = list_hr_zones_by_activity(db_path)
    return [
        _row_to_summary(row, zones_by_activity.get(int(row["activity_id"]), []))
        for row in rows
    ]


def latest_activity_start(db_path: Path | None = None) -> datetime | None:
    with connect(db_path) as connection:
        value = connection.execute("SELECT MAX(start_time_local) FROM activities").fetchone()[0]
    return datetime.fromisoformat(value) if value else None


def _row_to_summary(row, heart_rate_zones: list[dict[str, Any]] | None = None) -> dict[str, Any]:
    speed = row["average_speed"]
    return {
        "activityId": row["activity_id"],
        "activityName": row["activity_name"],
        "startTimeLocal": row["start_time_local"],
        "distance": row["distance"],
        "km": round(row["distance"] / 1000, 2),
        "duration": row["duration"],
        "averageSpeed": speed,
        "pace": calculate_pace(speed),
        "paceDecimal": calc_pace_decimal(speed),
        "averageHR": row["average_hr"],
        "maxHR": row["max_hr"],
        "calories": row["calories"],
        "elevationGain": row["elevation_gain"],
        "heartRateZones": heart_rate_zones or [],
    }


def encode_raw_data(data: dict[str, Any]) -> str:
    return json.dumps(data, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
