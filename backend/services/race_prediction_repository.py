import json
import re
from datetime import date, datetime
from pathlib import Path
from typing import Any

from services.database import connect

PREDICTION_KEYS = ("5k", "10k", "half_marathon", "marathon")


def upsert_race_predictions(
    predictions: list[dict[str, Any]],
    db_path: Path | None = None,
) -> int:
    """Salva lo storico delle previsioni restituito direttamente da Garmin."""
    synced_at = datetime.now().isoformat(timespec="seconds")
    with connect(db_path) as connection:
        connection.executemany(
            """
            INSERT INTO race_predictions (
                prediction_date, granularity, five_k_seconds, ten_k_seconds,
                half_marathon_seconds, marathon_seconds, raw_data, synced_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(prediction_date, granularity) DO UPDATE SET
                five_k_seconds = excluded.five_k_seconds,
                ten_k_seconds = excluded.ten_k_seconds,
                half_marathon_seconds = excluded.half_marathon_seconds,
                marathon_seconds = excluded.marathon_seconds,
                raw_data = excluded.raw_data,
                synced_at = excluded.synced_at
            """,
            [
                (
                    item["date"],
                    item["granularity"],
                    item.get("5k"),
                    item.get("10k"),
                    item.get("half_marathon"),
                    item.get("marathon"),
                    json.dumps(item.get("raw", {}), ensure_ascii=False, default=str),
                    synced_at,
                )
                for item in predictions
            ],
        )
    return len(predictions)


def list_race_predictions(
    granularity: str | None = None,
    db_path: Path | None = None,
) -> list[dict[str, Any]]:
    """Restituisce le previsioni Garmin ordinate cronologicamente."""
    condition = "WHERE granularity = ?" if granularity else ""
    parameters = (granularity,) if granularity else ()
    with connect(db_path) as connection:
        rows = connection.execute(
            f"""
            SELECT prediction_date, granularity, five_k_seconds, ten_k_seconds,
                   half_marathon_seconds, marathon_seconds
            FROM race_predictions
            {condition}
            ORDER BY prediction_date
            """,
            parameters,
        ).fetchall()
    return [
        {
            "date": row["prediction_date"],
            "granularity": row["granularity"],
            "5k": row["five_k_seconds"],
            "10k": row["ten_k_seconds"],
            "halfMarathon": row["half_marathon_seconds"],
            "marathon": row["marathon_seconds"],
        }
        for row in rows
    ]


def normalize_garmin_predictions(
    payload: Any,
    granularity: str,
) -> list[dict[str, Any]]:
    """Converte le risposte daily/monthly di Garmin nel formato della card."""
    aliases = {
        "5k": {"5k", "prediction5k", "raceprediction5k", "time5k"},
        "10k": {"10k", "prediction10k", "raceprediction10k", "time10k"},
        "half_marathon": {"halfmarathon", "predictionhalfmarathon", "timehalfmarathon"},
        "marathon": {"marathon", "predictionmarathon", "timemarathon"},
    }
    date_keys = ("calendarDate", "date", "predictionDate", "month")

    def normalized_key(value: Any) -> str:
        """Rimuove maiuscole e separatori per confrontare le chiavi Garmin."""
        return re.sub(r"[^a-z0-9]", "", str(value).lower())

    def flatten(value: Any) -> list[dict[str, Any]]:
        """Trova ricorsivamente tutti i record che contengono una data."""
        if isinstance(value, list):
            records = []
            for item in value:
                records.extend(flatten(item))
            return records
        if not isinstance(value, dict):
            return []
        if any(value.get(key) for key in date_keys):
            merged = dict(value)
            for child in value.values():
                if isinstance(child, dict):
                    merged.update(child)
            return [merged]
        records = []
        for child in value.values():
            records.extend(flatten(child))
        return records

    candidates = flatten(payload)
    result = []
    for item in candidates:
        raw_date = next(
            (item.get(key) for key in ("calendarDate", "date", "predictionDate", "month")
             if item.get(key)),
            None,
        )
        if not raw_date:
            continue
        parsed_date = str(raw_date)
        if granularity == "monthly" and len(parsed_date) == 7:
            parsed_date += "-01"
        else:
            parsed_date = parsed_date[:10]
        values = {}
        for target, keys in aliases.items():
            value = next(
                (
                    raw_value
                    for key, raw_value in item.items()
                    if normalized_key(key) in keys and raw_value is not None
                ),
                None,
            )
            try:
                values[target] = float(value) if value is not None else None
            except (TypeError, ValueError):
                values[target] = None
        if any(value is not None for value in values.values()):
            result.append({"date": parsed_date, "granularity": granularity, **values, "raw": item})
    return result
