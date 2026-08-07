import math
import re
import json
from datetime import datetime
from typing import Any

GARMIN_RUNNING_RECORD_TYPES = {
    1: ("1k", 1.0),
    3: ("5k", 5.0),
    4: ("10k", 10.0),
    5: ("Half Marathon", 21.0975),
    6: ("Full Marathon", 42.195),
}
SUPPORTED_ACTIVITY_TYPES = {"running", "cycling"}


def _encode_raw_data(data: dict[str, Any]) -> str:
    return json.dumps(data, ensure_ascii=False, sort_keys=True, separators=(",", ":"), default=str)


def clean_value(value: Any) -> Any:
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
    value = clean_value(value)
    if value is None:
        return None
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None
    return number if math.isfinite(number) else None


def normalize_activity_type(raw: dict[str, Any]) -> str:
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
    for key in keys:
        value = float_or_none(raw.get(key))
        if value is not None:
            return value
    return None


def normalize_personal_records(raw_response: Any) -> list[dict[str, Any]]:
    normalized = []
    for raw in _find_personal_records(raw_response):
        type_id = clean_value(raw.get("typeId"))
        try:
            normalized_type_id = int(type_id)
        except (TypeError, ValueError):
            continue
        record_definition = GARMIN_RUNNING_RECORD_TYPES.get(normalized_type_id)
        if record_definition is None:
            continue

        duration = float_or_none(raw.get("value"))
        record_date = _personal_record_date(raw)
        if duration is None or duration < 0 or record_date is None:
            continue

        record_key, distance_km = record_definition
        activity_id = clean_value(raw.get("activityId"))
        try:
            normalized_activity_id = int(activity_id) if activity_id is not None else None
        except (TypeError, ValueError):
            normalized_activity_id = None
        cleaned_raw = {key: clean_value(value) for key, value in raw.items()}
        normalized.append(
            {
                "record_key": record_key,
                "type_id": normalized_type_id,
                "activity_id": normalized_activity_id,
                "distance_km": distance_km,
                "duration": duration,
                "record_date": record_date,
                "raw_data": _encode_raw_data(cleaned_raw),
            }
        )
    return normalized


def _find_personal_records(value: Any) -> list[dict[str, Any]]:
    if isinstance(value, list):
        return [record for item in value for record in _find_personal_records(item)]
    if not isinstance(value, dict):
        return []
    if "typeId" in value and "value" in value:
        return [value]
    return [record for item in value.values() for record in _find_personal_records(item)]


def _personal_record_date(raw: dict[str, Any]) -> str | None:
    for field in (
        "activityStartDateTimeLocalFormatted",
        "actStartDateTimeInGMTFormatted",
    ):
        value = clean_value(raw.get(field))
        if value and len(str(value)) >= 10:
            candidate = str(value)[:10]
            try:
                return datetime.fromisoformat(candidate).date().isoformat()
            except ValueError:
                pass

    for field in (
        "activityStartDateTimeLocal",
        "activityStartDateTimeInGMT",
        "prStartTimeLocal",
        "prStartTimeGmt",
    ):
        value = clean_value(raw.get(field))
        if value is None:
            continue
        try:
            timestamp = float(value)
            if timestamp > 100_000_000_000:
                timestamp /= 1000
            return datetime.fromtimestamp(timestamp).date().isoformat()
        except (OSError, OverflowError, TypeError, ValueError):
            continue
    return None
