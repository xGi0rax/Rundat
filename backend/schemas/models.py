from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class ApiModel(BaseModel):
    model_config = ConfigDict(extra="forbid", populate_by_name=True)


class HeartRateZone(ApiModel):
    zone: int = Field(ge=1, le=5)
    seconds: float = Field(ge=0)
    percentage: float = Field(ge=0, le=100)
    low_bpm: float | None = Field(default=None, alias="lowBpm", ge=0)
    high_bpm: float | None = Field(default=None, alias="highBpm", ge=0)


class ActivitySummary(ApiModel):
    activity_id: int = Field(alias="activityId")
    activity_name: str | None = Field(default=None, alias="activityName")
    activity_type: Literal["running", "cycling"] = Field(alias="activityType")
    start_time_local: datetime = Field(alias="startTimeLocal")
    distance: float = Field(ge=0, description="Distance in metres")
    km: float = Field(ge=0)
    duration: float = Field(ge=0, description="Duration in seconds")
    average_speed: float | None = Field(default=None, alias="averageSpeed", ge=0)
    pace: str | None = None
    pace_decimal: float | None = Field(default=None, alias="paceDecimal", ge=0)
    average_hr: float | None = Field(default=None, alias="averageHR", ge=0)
    max_hr: float | None = Field(default=None, alias="maxHR", ge=0)
    calories: float | None = Field(default=None, ge=0)
    elevation_gain: float | None = Field(default=None, alias="elevationGain")
    heart_rate_zones: list[HeartRateZone] = Field(
        default_factory=list,
        alias="heartRateZones",
    )


class RoutePoint(ApiModel):
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)
    elevation: float | None = None


class ActivityRoute(ApiModel):
    activity_id: int = Field(alias="activityId")
    status: Literal["success", "unavailable", "failed", "pending"]
    points: list[RoutePoint] = Field(default_factory=list)
    point_count: int = Field(alias="pointCount", ge=0)
    error_message: str | None = Field(default=None, alias="errorMessage")


class DashboardSummary(ApiModel):
    total_activities: int = Field(alias="totalActivities", ge=0)
    total_distance_km: float = Field(alias="totalDistanceKm", ge=0)
    last_7_days_distance_km: float = Field(alias="last7DaysDistanceKm", ge=0)
    average_pace: str | None = Field(default=None, alias="averagePace")
    average_pace_decimal: float | None = Field(default=None, alias="averagePaceDecimal", ge=0)
    latest_activity: ActivitySummary | None = Field(default=None, alias="latestActivity")


class RacePrediction(ApiModel):
    date: str
    granularity: Literal["daily", "monthly"]
    five_k: float | None = Field(default=None, alias="5k", ge=0)
    ten_k: float | None = Field(default=None, alias="10k", ge=0)
    half_marathon: float | None = Field(default=None, alias="halfMarathon", ge=0)
    marathon: float | None = Field(default=None, ge=0)


class SyncRun(ApiModel):
    id: int
    source: Literal["csv", "garmin"]
    status: Literal["running", "success", "failed"]
    started_at: datetime = Field(alias="startedAt")
    finished_at: datetime | None = Field(default=None, alias="finishedAt")
    inserted_count: int = Field(alias="insertedCount", ge=0)
    updated_count: int = Field(alias="updatedCount", ge=0)
    skipped_count: int = Field(alias="skippedCount", ge=0)
    hr_zone_count: int = Field(default=0, alias="hrZoneCount", ge=0)
    error_message: str | None = Field(default=None, alias="errorMessage")
