import json
from datetime import datetime
from pathlib import Path
from typing import Any

from services.database import connect


def save_diagnostic_snapshot(
    metric: str,
    snapshot_date: str,
    status: str,
    payload: Any = None,
    error_message: str | None = None,
    db_path: Path | None = None,
) -> None:
    """Salva il risultato grezzo di una singola chiamata diagnostica Garmin."""
    encoded_payload = json.dumps(
        payload,
        ensure_ascii=False,
        sort_keys=True,
        separators=(",", ":"),
        default=str,
    ) if payload is not None else None
    with connect(db_path) as connection:
        connection.execute(
            """
            INSERT INTO garmin_form_diagnostics (
                metric, snapshot_date, status, payload, error_message, fetched_at
            ) VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT(metric, snapshot_date) DO UPDATE SET
                status = excluded.status,
                payload = excluded.payload,
                error_message = excluded.error_message,
                fetched_at = excluded.fetched_at
            """,
            (
                metric,
                snapshot_date,
                status,
                encoded_payload,
                error_message,
                datetime.now().isoformat(timespec="seconds"),
            ),
        )


def list_diagnostic_metrics(db_path: Path | None = None) -> list[dict[str, Any]]:
    """Restituisce lo stato più recente di ogni metrica diagnostica."""
    with connect(db_path) as connection:
        rows = connection.execute(
            """
            SELECT metric, snapshot_date, status, error_message, fetched_at
            FROM garmin_form_diagnostics
            WHERE (metric, snapshot_date) IN (
                SELECT metric, MAX(snapshot_date)
                FROM garmin_form_diagnostics
                GROUP BY metric
            )
            ORDER BY metric
            """
        ).fetchall()
    return [dict(row) for row in rows]
