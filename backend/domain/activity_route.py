from __future__ import annotations

from typing import Any
from xml.etree import ElementTree

MAX_ROUTE_POINTS = 800


def parse_gpx_route(raw_gpx: bytes | str, max_points: int = MAX_ROUTE_POINTS) -> list[dict[str, float | None]]:
    """Extract and uniformly simplify track points from a Garmin GPX document."""
    if not raw_gpx:
        return []
    try:
        root = ElementTree.fromstring(raw_gpx)
    except ElementTree.ParseError as error:
        raise ValueError("Il tracciato Garmin non è un GPX valido.") from error

    points: list[dict[str, float | None]] = []
    for element in root.iter():
        if not (element.tag.endswith("trkpt") or element.tag.endswith("rtept")):
            continue
        latitude = _coordinate(element.attrib.get("lat"), -90, 90)
        longitude = _coordinate(element.attrib.get("lon"), -180, 180)
        if latitude is None or longitude is None:
            continue
        elevation = None
        for child in element:
            if child.tag.endswith("ele"):
                elevation = _number(child.text)
                break
        point = {
            "latitude": round(latitude, 6),
            "longitude": round(longitude, 6),
            "elevation": round(elevation, 1) if elevation is not None else None,
        }
        if not points or (
            point["latitude"] != points[-1]["latitude"]
            or point["longitude"] != points[-1]["longitude"]
        ):
            points.append(point)

    return _uniform_sample(points, max_points)


def _uniform_sample(points: list[dict[str, Any]], maximum: int) -> list[dict[str, Any]]:
    if maximum < 2:
        raise ValueError("max_points deve essere almeno 2.")
    if len(points) <= maximum:
        return points
    last_index = len(points) - 1
    indexes = [round(index * last_index / (maximum - 1)) for index in range(maximum)]
    return [points[index] for index in indexes]


def _coordinate(value: Any, minimum: float, maximum: float) -> float | None:
    number = _number(value)
    return number if number is not None and minimum <= number <= maximum else None


def _number(value: Any) -> float | None:
    try:
        return float(value)
    except (TypeError, ValueError):
        return None
