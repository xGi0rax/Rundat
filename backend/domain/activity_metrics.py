import math
from typing import Any


def _positive_number(value: Any) -> float | None:
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None
    return number if math.isfinite(number) and number > 0 else None


def calculate_pace(speed_ms: Any) -> str | None:
    """Format metres/second as a rounded min/km pace."""
    speed = _positive_number(speed_ms)
    if speed is None:
        return None
    pace_seconds = int((1000 / speed) + 0.5)
    minutes, seconds = divmod(pace_seconds, 60)
    return f"{minutes}:{seconds:02d}"


def calc_pace_decimal(speed_ms: Any) -> float | None:
    """Convert metres/second to decimal min/km."""
    speed = _positive_number(speed_ms)
    return round(1000 / speed / 60, 2) if speed is not None else None
