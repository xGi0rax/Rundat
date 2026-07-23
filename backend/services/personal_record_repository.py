from datetime import datetime
from pathlib import Path
from typing import Any, Iterable

from services.database import connect


def replace_personal_records(
    records: Iterable[dict[str, Any]],
    db_path: Path | None = None,
) -> None:
    synced_at = datetime.now().isoformat(timespec="seconds")
    records = list(records)

    with connect(db_path) as connection:
        connection.execute("DELETE FROM personal_records")
        connection.executemany(
            """
            INSERT INTO personal_records (
                record_key, type_id, activity_id, distance_km, duration,
                record_date, raw_data, synced_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            [
                (
                    record["record_key"],
                    record["type_id"],
                    record["activity_id"],
                    record["distance_km"],
                    record["duration"],
                    record["record_date"],
                    record["raw_data"],
                    synced_at,
                )
                for record in records
            ],
        )
        connection.executemany(
            """
            INSERT OR IGNORE INTO personal_record_history (
                record_key, type_id, activity_id, distance_km, duration,
                record_date, raw_data, observed_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            [
                (
                    record["record_key"],
                    record["type_id"],
                    record["activity_id"],
                    record["distance_km"],
                    record["duration"],
                    record["record_date"],
                    record["raw_data"],
                    synced_at,
                )
                for record in records
            ],
        )


def list_personal_records(db_path: Path | None = None) -> list[dict[str, Any]]:
    with connect(db_path) as connection:
        rows = connection.execute(
            """
            SELECT pr.record_key, pr.distance_km, pr.duration,
                   COALESCE(substr(a.start_time_local, 1, 10), pr.record_date) AS record_date,
                   a.average_hr
            FROM personal_records AS pr
            LEFT JOIN activities AS a ON a.activity_id = pr.activity_id
            ORDER BY pr.type_id
            """
        ).fetchall()
    return [dict(row) for row in rows]


def list_personal_record_history(db_path: Path | None = None) -> list[dict[str, Any]]:
    with connect(db_path) as connection:
        rows = connection.execute(
            """
            SELECT record_key, distance_km, duration, record_date, observed_at
            FROM personal_record_history
            ORDER BY record_date, id
            """
        ).fetchall()
    return [dict(row) for row in rows]
