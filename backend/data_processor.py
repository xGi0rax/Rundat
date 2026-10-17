import pandas as pd
import numpy as np
from datetime import datetime, timedelta
from typing import Any

from config import CSV_FILE
from domain.activity_metrics import calc_pace_decimal, calculate_pace

def load_and_clean_data():
    """Carica il CSV, normalizza le metriche e ordina le attività per data."""
    if not CSV_FILE.exists():
        raise FileNotFoundError(f"CSV file '{CSV_FILE}' not found.")

    # Dataset tabellare delle attività, trasformato progressivamente sotto.
    df = pd.read_csv(CSV_FILE)

    # Date
    df['startTimeLocal'] = pd.to_datetime(df['startTimeLocal'])

    # Distanza in km
    df['km'] = (df['distance'].fillna(0) / 1000).round(2)
    df = df[df['km'] >= 1.0].copy()  # Rimuovo attività con distanza < 1 km

    # Passo al km
    df['pace_str'] = df['averageSpeed'].apply(calculate_pace)
    df['pace_decimal'] = df['averageSpeed'].apply(calc_pace_decimal)

    # Zone cardio
    zone_cols = [f'hrTimeInZone_{i}' for i in range(1, 6)]
    for col in zone_cols:
        if col in df.columns:
            df[col] = df[col].fillna(0)

    df['total_hr_time'] = df[[col for col in zone_cols if col in df.columns]].sum(axis=1)

    for i in range(1, 6):
        col = f'hrTimeInZone_{i}'
        if col in df.columns:
            df[f'zone_{i}_mins'] = (df[col] / 60).round(1)
            df[f'zone_{i}_perc'] = np.where(
                df['total_hr_time'] > 0,
                (df[col] / df['total_hr_time'] * 100).round(1),
                0
            )
    # Restituisco ordinato per data decrescente
    return df.sort_values(by='startTimeLocal', ascending=False)


# Funzione per restituire la lista di attività come dizionari, con gestione dei NaN e formattazione della data
def get_activities_list():
    """Restituisce l'operazione get activities list."""
    df = load_and_clean_data()
    df = df.replace({np.nan: None})
    df['startTimeLocal'] = df['startTimeLocal'].dt.strftime('%Y-%m-%dT%H:%M:%S')
    return df.to_dict(orient='records')


def _optional_number(value: Any):
    """Gestisce l'operazione optional number."""
    return None if pd.isna(value) else value


def _activity_summary(row: pd.Series) -> dict[str, Any]:
    """Converte una riga Pandas nel formato sintetico restituito dall'API."""
    # Riga dell'attività corrente, già pulita da load_and_clean_data.
    start_time = row['startTimeLocal']
    return {
        'activityId': int(row['activityId']),
        'activityName': _optional_number(row.get('activityName')),
        'activityType': 'running',
        'startTimeLocal': start_time.to_pydatetime() if hasattr(start_time, 'to_pydatetime') else start_time,
        'distance': float(row['distance']),
        'km': float(row['km']),
        'duration': float(row['duration']),
        'averageSpeed': _optional_number(row.get('averageSpeed')),
        'pace': _optional_number(row.get('pace_str')),
        'paceDecimal': _optional_number(row.get('pace_decimal')),
        'averageHR': _optional_number(row.get('averageHR')),
        'maxHR': _optional_number(row.get('maxHR')),
        'calories': _optional_number(row.get('calories')),
        'elevationGain': _optional_number(row.get('elevationGain')),
    }


def get_activity_summaries() -> list[dict[str, Any]]:
    """Restituisce l'operazione get activity summaries."""
    df = load_and_clean_data()
    return [_activity_summary(row) for _, row in df.iterrows()]


def get_dashboard_summary(now: datetime | None = None) -> dict[str, Any]:
    """Restituisce l'operazione get dashboard summary."""
    df = load_and_clean_data()
    reference_time = now or datetime.now()
    recent_cutoff = reference_time - timedelta(days=7)
    recent_df = df[df['startTimeLocal'] >= recent_cutoff]

    total_distance_m = float(df['distance'].fillna(0).sum())
    total_duration_s = float(df['duration'].fillna(0).sum())
    average_speed = total_distance_m / total_duration_s if total_duration_s > 0 else None

    return {
        'totalActivities': int(len(df)),
        'totalDistanceKm': round(total_distance_m / 1000, 2),
        'last7DaysDistanceKm': round(float(recent_df['distance'].fillna(0).sum()) / 1000, 2),
        'averagePace': calculate_pace(average_speed) if average_speed else None,
        'averagePaceDecimal': calc_pace_decimal(average_speed) if average_speed else None,
        'latestActivity': _activity_summary(df.iloc[0]) if not df.empty else None,
    }
