import json
from datetime import datetime
from pathlib import Path
from typing import Any

from services.database import connect


def latest_activity_id(activity_type: str, db_path: Path | None = None) -> int | None:
    with connect(db_path) as connection:
        row = connection.execute(
            """
            SELECT activity_id
            FROM activities
            WHERE activity_type = ?
            ORDER BY start_time_local DESC
            LIMIT 1
            """,
            (activity_type,),
        ).fetchone()
    return int(row["activity_id"]) if row else None


def route_needs_sync(activity_id: int, db_path: Path | None = None) -> bool:
    with connect(db_path) as connection:
        row = connection.execute(
            "SELECT status FROM activity_routes WHERE activity_id = ?",
            (activity_id,),
        ).fetchone()
    return row is None or row["status"] == "failed"


def save_activity_route(
    activity_id: int,
    points: list[dict[str, Any]],
    status: str,
    error_message: str | None = None,
    db_path: Path | None = None,
) -> None:
    with connect(db_path) as connection:
        connection.execute(
            """
            INSERT INTO activity_routes (
                activity_id, status, points_data, point_count, error_message, synced_at
            ) VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT (activity_id) DO UPDATE SET
                status = excluded.status,
                points_data = excluded.points_data,
                point_count = excluded.point_count,
                error_message = excluded.error_message,
                synced_at = excluded.synced_at
            """,
            (
                activity_id,
                status,
                json.dumps(points, ensure_ascii=False, separators=(",", ":")),
                len(points),
                error_message,
                datetime.now().isoformat(timespec="seconds"),
            ),
        )


def get_activity_route(activity_id: int, db_path: Path | None = None) -> dict[str, Any]:
    with connect(db_path) as connection:
        activity = connection.execute(
            "SELECT activity_id FROM activities WHERE activity_id = ?",
            (activity_id,),
        ).fetchone()
        if activity is None:
            raise LookupError(f"Attività {activity_id} non trovata.")
        row = connection.execute(
            """
            SELECT activity_id, status, points_data, point_count, error_message
            FROM activity_routes
            WHERE activity_id = ?
            """,
            (activity_id,),
        ).fetchone()

    if row is None:
        return {
            "activityId": activity_id,
            "status": "pending",
            "points": [],
            "pointCount": 0,
            "errorMessage": None,
        }
    return {
        "activityId": int(row["activity_id"]),
        "status": row["status"],
        "points": json.loads(row["points_data"]),
        "pointCount": int(row["point_count"]),
        "errorMessage": row["error_message"],
    }
