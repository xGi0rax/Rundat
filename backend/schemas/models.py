from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class ApiModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class ActivitySummary(ApiModel):
    activity_id: int = Field(alias="activityId")
    activity_name: str | None = Field(default=None, alias="activityName")
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


class PersonalBest(ApiModel):
    distance: float = Field(ge=0)
    date: str
    time: str
    pace: str | None = None
    hr: float | None = Field(default=None, ge=0)


class DashboardSummary(ApiModel):
    total_activities: int = Field(alias="totalActivities", ge=0)
    total_distance_km: float = Field(alias="totalDistanceKm", ge=0)
    last_7_days_distance_km: float = Field(alias="last7DaysDistanceKm", ge=0)
    average_pace: str | None = Field(default=None, alias="averagePace")
    average_pace_decimal: float | None = Field(default=None, alias="averagePaceDecimal", ge=0)
    latest_activity: ActivitySummary | None = Field(default=None, alias="latestActivity")
    personal_bests: dict[str, PersonalBest] = Field(alias="personalBests")
