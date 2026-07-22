from datetime import datetime, timedelta
from pathlib import Path
from typing import Any

from data_processor import calc_pace_decimal, calculate_pace
from services.activity_repository import list_activities

DISTANCE_RANGES = {
    "1k": (0.9, 1.1),
    "5k": (4.9, 5.2),
    "10k": (9.8, 10.2),
    "Half Marathon": (20.9, 21.3),
    "Full Marathon": (41.9, 42.5),
}


def get_activities(db_path: Path | None = None) -> list[dict[str, Any]]:
    return list_activities(db_path)


def get_personal_bests(
    activities: list[dict[str, Any]] | None = None,
    db_path: Path | None = None,
) -> dict[str, dict[str, Any]]:
    activities = activities if activities is not None else list_activities(db_path)
    records = {}
    for name, (minimum, maximum) in DISTANCE_RANGES.items():
        candidates = [activity for activity in activities if minimum <= activity["km"] <= maximum]
        if not candidates:
            continue
        best = min(candidates, key=lambda activity: activity["duration"])
        records[name] = {
            "distance": best["km"],
            "date": str(best["startTimeLocal"])[:10],
            "time": _format_duration(best["duration"]),
            "pace": best["pace"],
            "hr": best["averageHR"],
        }
    return records


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
        "personalBests": get_personal_bests(activities),
    }


def _format_duration(seconds: float) -> str:
    total = int(seconds)
    hours, remainder = divmod(total, 3600)
    minutes, seconds = divmod(remainder, 60)
    return f"{hours:02d}:{minutes:02d}:{seconds:02d}" if hours else f"{minutes:02d}:{seconds:02d}"
