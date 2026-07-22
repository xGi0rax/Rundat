import pandas as pd
import numpy as np
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any

CSV_FILE = Path(__file__).resolve().parent / "running_activities_FULL.csv"

def load_and_clean_data():
    if not CSV_FILE.exists():
        raise FileNotFoundError(f"CSV file '{CSV_FILE}' not found.")

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


# Funzione per calcolare il passo al km (min/km) da velocità in m/s
def calculate_pace(speed_ms):
    if pd.isna(speed_ms) or speed_ms <= 0:
        return None

    # Round to the nearest second before splitting minutes and seconds. This
    # also handles values such as 4:59.6 correctly, returning 5:00.
    pace_seconds = int((1000 / speed_ms) + 0.5)
    minutes, seconds = divmod(pace_seconds, 60)
    return f"{minutes}:{seconds:02d}"


# Funzione per calcolare il passo al km in formato decimale (min/km) da velocità in m/s
def calc_pace_decimal(speed_ms):
    if pd.isna(speed_ms) or speed_ms <= 0:
        return None
    
    return round((1000 / speed_ms / 60), 2)


# Funzione per restituire la lista di attività come dizionari, con gestione dei NaN e formattazione della data
def get_activities_list():
    df = load_and_clean_data()
    df = df.replace({np.nan: None})
    df['startTimeLocal'] = df['startTimeLocal'].dt.strftime('%Y-%m-%dT%H:%M:%S')
    return df.to_dict(orient='records')


def _optional_number(value: Any):
    return None if pd.isna(value) else value


def _activity_summary(row: pd.Series) -> dict[str, Any]:
    start_time = row['startTimeLocal']
    return {
        'activityId': int(row['activityId']),
        'activityName': _optional_number(row.get('activityName')),
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
    df = load_and_clean_data()
    return [_activity_summary(row) for _, row in df.iterrows()]


def get_dashboard_summary(now: datetime | None = None) -> dict[str, Any]:
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
        'personalBests': get_personal_bests(df),
    }

# Funzione per recuperare i record
def get_personal_bests(df=None):
    if df is None:
        df = load_and_clean_data()
    records = {}
    
    distances = {
        '1k': (0.9, 1.1),
        '5k': (4.9, 5.2),
        '10k': (9.8, 10.2),
        'Half Marathon': (20.9, 21.3),
        'Full Marathon': (41.9, 42.5)
    }

    for name, (min_d, max_d) in distances.items():
        subset = df[(df['km'] >= min_d) & (df['km'] <= max_d)]
        if not subset.empty:
            best_run = subset.nsmallest(1, 'duration').iloc[0]

            durration_sec = best_run['duration']
            h = int(durration_sec // 3600)
            m = int((durration_sec % 3600) // 60)
            s = int(durration_sec % 60)
            time_str = f"{h:02d}:{m:02d}:{s:02d}" if h > 0 else f"{m:02d}:{s:02d}"

            records[name] = {
                'distance': float(best_run['km']),
                'date': best_run['startTimeLocal'].strftime('%Y-%m-%d'),
                'time': time_str,
                'pace': best_run['pace_str'],
                'hr': _optional_number(best_run.get('averageHR', None))
            }
    
    return records
