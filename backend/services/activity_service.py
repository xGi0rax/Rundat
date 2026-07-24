from datetime import datetime, timedelta
from pathlib import Path
from typing import Any

from domain.activity_metrics import calc_pace_decimal, calculate_pace
from services.activity_repository import list_activities
from services.personal_record_repository import list_personal_record_history, list_personal_records


def get_activities(db_path: Path | None = None) -> list[dict[str, Any]]:
    return list_activities(db_path)


def get_personal_bests(
    db_path: Path | None = None,
) -> dict[str, dict[str, Any]]:
    records = {}
    for record in list_personal_records(db_path):
        distance = record["distance_km"]
        duration = record["duration"]
        records[record["record_key"]] = {
            "distance": distance,
            "date": record["record_date"],
            "time": _format_duration(duration),
            "pace": calculate_pace((distance * 1000) / duration) if duration > 0 else None,
            "hr": record["average_hr"],
        }
    return records


def get_personal_best_history(db_path: Path | None = None) -> list[dict[str, Any]]:
    return [
        {
            "recordKey": record["record_key"],
            "distance": record["distance_km"],
            "duration": record["duration"],
            "date": record["record_date"],
            "observedAt": record["observed_at"],
        }
        for record in list_personal_record_history(db_path)
    ]


def get_dashboard(now: datetime | None = None, db_path: Path | None = None) -> dict[str, Any]:
    activities = list_activities(db_path)
    reference_time = now or datetime.now()
    recent_cutoff = reference_time - timedelta(days=7)
    total_distance = sum(activity["distance"] for activity in activities)
    total_duration = sum(activity["duration"] for activity in activities)
    recent_distance = sum(
        activity["distance"]
        for activity in activities
        if datetime.fromisoformat(activity["startTimeLocal"]) >= recent_cutoff
    )
    average_speed = total_distance / total_duration if total_duration > 0 else None
    return {
        "totalActivities": len(activities),
        "totalDistanceKm": round(total_distance / 1000, 2),
        "last7DaysDistanceKm": round(recent_distance / 1000, 2),
        "averagePace": calculate_pace(average_speed) if average_speed else None,
        "averagePaceDecimal": calc_pace_decimal(average_speed) if average_speed else None,
        "latestActivity": activities[0] if activities else None,
        "personalBests": get_personal_bests(db_path),
    }


def _format_duration(seconds: float) -> str:
    total = int(seconds)
    hours, remainder = divmod(total, 3600)
    minutes, seconds = divmod(remainder, 60)
    return f"{hours:02d}:{minutes:02d}:{seconds:02d}" if hours else f"{minutes:02d}:{seconds:02d}"
