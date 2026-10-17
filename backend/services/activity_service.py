from datetime import datetime, timedelta
from pathlib import Path
from typing import Any

from domain.activity_metrics import calc_pace_decimal, calculate_pace
from services.activity_repository import list_activities


def get_activities(db_path: Path | None = None) -> list[dict[str, Any]]:
    """Restituisce l'operazione get activities."""
    return list_activities(db_path)


def get_dashboard(now: datetime | None = None, db_path: Path | None = None) -> dict[str, Any]:
    """Restituisce l'operazione get dashboard."""
    activities = list_activities(db_path, activity_type="running")
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
    }
