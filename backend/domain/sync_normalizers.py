import math
import re
import json
from datetime import datetime
from typing import Any

SUPPORTED_ACTIVITY_TYPES = {"running", "cycling"}


def _encode_raw_data(data: dict[str, Any]) -> str:
    """Gestisce l'operazione encode raw data."""
    return json.dumps(data, ensure_ascii=False, sort_keys=True, separators=(",", ":"), default=str)


def clean_value(value: Any) -> Any:
    """Gestisce l'operazione clean value."""
    if value is None:
        return None
    if hasattr(value, "item"):
        try:
            value = value.item()
        except (TypeError, ValueError):
            pass
    if isinstance(value, float) and not math.isfinite(value):
        return None
    return value


def float_or_none(value: Any) -> float | None:
    """Gestisce l'operazione float or none."""
    value = clean_value(value)
    if value is None:
        return None
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None
    return number if math.isfinite(number) else None


def normalize_activity_type(raw: dict[str, Any]) -> str:
    """Normalizza l'operazione normalize activity type."""
    activity_type = clean_value(raw.get("activityType"))
    if isinstance(activity_type, dict):
        value = activity_type.get("typeKey") or activity_type.get("parentTypeId")
    else:
        value = activity_type
    value = clean_value(raw.get("activityTypeKey")) or value
    normalized = str(value or "running").strip().lower()
    if "cycl" in normalized or "bik" in normalized:
        return "cycling"
    if "run" in normalized:
        return "running"
    return normalized


def normalize_activity(raw: dict[str, Any]) -> dict[str, Any] | None:
    """Normalizza l'operazione normalize activity."""
    activity_id = clean_value(raw.get("activityId"))
    start_time = clean_value(raw.get("startTimeLocal"))
    distance = float_or_none(raw.get("distance"))
    duration = float_or_none(raw.get("duration"))
    if activity_id is None or start_time is None or distance is None or duration is None:
        return None
    if distance < 0 or duration < 0:
        return None

    if hasattr(start_time, "to_pydatetime"):
        start_time = start_time.to_pydatetime()
    if not isinstance(start_time, datetime):
        try:
            start_time = datetime.fromisoformat(str(start_time))
        except ValueError:
            return None
    try:
        normalized_id = int(activity_id)
    except (TypeError, ValueError):
        return None

    cleaned_raw = {key: clean_value(value) for key, value in raw.items()}
    cleaned_raw["startTimeLocal"] = start_time.isoformat(timespec="seconds")
    return {
        "activity_id": normalized_id,
        "activity_name": clean_value(raw.get("activityName")),
        "activity_type": normalize_activity_type(raw),
        "start_time_local": start_time.isoformat(timespec="seconds"),
        "distance": distance,
        "duration": duration,
        "average_speed": float_or_none(raw.get("averageSpeed")),
        "average_hr": float_or_none(raw.get("averageHR")),
        "max_hr": float_or_none(raw.get("maxHR")),
        "calories": float_or_none(raw.get("calories")),
        "elevation_gain": float_or_none(raw.get("elevationGain")),
        "raw_data": _encode_raw_data(cleaned_raw),
    }


def normalize_hr_zones(raw_response: Any) -> list[dict[str, Any]]:
    """Normalize Garmin API and legacy CSV heart-rate zone shapes."""
    zones: dict[int, dict[str, Any]] = {}

    def add_zone(zone_value: Any, seconds_value: Any, raw: dict[str, Any]) -> None:
        """Aggiunge l'operazione add zone."""
        seconds = float_or_none(seconds_value)
        try:
            zone_number = int(zone_value)
        except (TypeError, ValueError):
            return
        if zone_number not in range(1, 6) or seconds is None or seconds < 0:
            return
        zones[zone_number] = {
            "zone_number": zone_number,
            "seconds": seconds,
            "low_bpm": _first_float(
                raw,
                "zoneLowBoundary",
                "lowBoundary",
                "lowBpm",
                "minHeartRate",
            ),
            "high_bpm": _first_float(
                raw,
                "zoneHighBoundary",
                "highBoundary",
                "highBpm",
                "maxHeartRate",
            ),
        }

    def visit(value: Any) -> None:
        """Visita l'operazione visit."""
        if isinstance(value, list):
            for item in value:
                visit(item)
            return
        if not isinstance(value, dict):
            return

        zone_value = next(
            (
                value.get(key)
                for key in ("zoneNumber", "zone", "zoneIndex")
                if value.get(key) is not None
            ),
            None,
        )
        seconds_value = next(
            (
                value.get(key)
                for key in ("secsInZone", "seconds", "timeInZone", "duration")
                if value.get(key) is not None
            ),
            None,
        )
        if zone_value is not None and seconds_value is not None:
            add_zone(zone_value, seconds_value, value)

        for key, item in value.items():
            match = re.fullmatch(r"hrTimeInZone[_-]?([1-5])", str(key), re.IGNORECASE)
            if match:
                add_zone(match.group(1), item, {})
            elif isinstance(item, (dict, list)):
                visit(item)

    visit(raw_response)
    ordered = [zones[number] for number in sorted(zones)]
    for index, zone in enumerate(ordered[:-1]):
        if zone["high_bpm"] is None and ordered[index + 1]["low_bpm"] is not None:
            zone["high_bpm"] = ordered[index + 1]["low_bpm"]
    return ordered


def _first_float(raw: dict[str, Any], *keys: str) -> float | None:
    """Gestisce l'operazione first float."""
    for key in keys:
        value = float_or_none(raw.get(key))
        if value is not None:
            return value
    return None
