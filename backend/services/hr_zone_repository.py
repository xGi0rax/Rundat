import json
from datetime import datetime
from pathlib import Path
from typing import Any, Iterable

from services.database import connect


def replace_activity_hr_zones(
    activity_id: int,
    zones: Iterable[dict[str, Any]],
    raw_response: Any,
    db_path: Path | None = None,
) -> None:
    """Gestisce l'operazione replace activity hr zones."""
    synced_at = datetime.now().isoformat(timespec="seconds")
    raw_data = json.dumps(
        raw_response,
        ensure_ascii=False,
        sort_keys=True,
        separators=(",", ":"),
        default=str,
    )
    normalized = list(zones)
    with connect(db_path) as connection:
        connection.execute(
            "DELETE FROM activity_hr_zones WHERE activity_id = ?",
            (activity_id,),
        )
        connection.executemany(
            """
            INSERT INTO activity_hr_zones (
                activity_id, zone_number, seconds, low_bpm, high_bpm,
                raw_data, synced_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            [
                (
                    activity_id,
                    zone["zone_number"],
                    zone["seconds"],
                    zone.get("low_bpm"),
                    zone.get("high_bpm"),
                    raw_data,
                    synced_at,
                )
                for zone in normalized
            ],
        )
        connection.execute(
            """
            INSERT INTO activity_hr_zone_sync (
                activity_id, status, synced_at, error_message
            ) VALUES (?, 'success', ?, NULL)
            ON CONFLICT(activity_id) DO UPDATE SET
                status = excluded.status,
                synced_at = excluded.synced_at,
                error_message = NULL
            """,
            (activity_id, synced_at),
        )


def mark_activity_hr_zones_failed(
    activity_id: int,
    error_message: str,
    db_path: Path | None = None,
) -> None:
    """Gestisce l'operazione mark activity hr zones failed."""
    with connect(db_path) as connection:
        connection.execute(
            """
            INSERT INTO activity_hr_zone_sync (
                activity_id, status, synced_at, error_message
            ) VALUES (?, 'failed', ?, ?)
            ON CONFLICT(activity_id) DO UPDATE SET
                status = excluded.status,
                synced_at = excluded.synced_at,
                error_message = excluded.error_message
            """,
            (
                activity_id,
                datetime.now().isoformat(timespec="seconds"),
                error_message[:500],
            ),
        )


def activity_ids_missing_hr_zones(
    limit: int = 20,
    db_path: Path | None = None,
) -> list[int]:
    """Gestisce l'operazione activity ids missing hr zones."""
    with connect(db_path) as connection:
        rows = connection.execute(
            """
            SELECT activities.activity_id
            FROM activities
            LEFT JOIN activity_hr_zone_sync
                ON activity_hr_zone_sync.activity_id = activities.activity_id
            WHERE activity_hr_zone_sync.activity_id IS NULL
               OR activity_hr_zone_sync.status = 'failed'
            ORDER BY
                CASE WHEN activity_hr_zone_sync.activity_id IS NULL THEN 0 ELSE 1 END,
                activities.start_time_local DESC
            LIMIT ?
            """,
            (limit,),
        ).fetchall()
    return [int(row["activity_id"]) for row in rows]


def list_hr_zones_by_activity(
    db_path: Path | None = None,
) -> dict[int, list[dict[str, Any]]]:
    """Elenca l'operazione list hr zones by activity."""
    with connect(db_path) as connection:
        rows = connection.execute(
            """
            SELECT activity_id, zone_number, seconds, low_bpm, high_bpm
            FROM activity_hr_zones
            ORDER BY activity_id, zone_number
            """
        ).fetchall()

    grouped: dict[int, list[dict[str, Any]]] = {}
    totals: dict[int, float] = {}
    for row in rows:
        activity_id = int(row["activity_id"])
        totals[activity_id] = totals.get(activity_id, 0) + float(row["seconds"])
        grouped.setdefault(activity_id, []).append(
            {
                "zone": int(row["zone_number"]),
                "seconds": float(row["seconds"]),
                "lowBpm": row["low_bpm"],
                "highBpm": row["high_bpm"],
            }
        )

    for activity_id, zones in grouped.items():
        total = totals[activity_id]
        for zone in zones:
            zone["percentage"] = round(zone["seconds"] / total * 100, 1) if total else 0
    return grouped
