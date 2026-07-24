import sqlite3
from contextlib import contextmanager
from pathlib import Path

from config import get_db_path


@contextmanager
def connect(db_path: Path | None = None):
    path = Path(db_path or get_db_path())
    path.parent.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(path, timeout=30)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA foreign_keys = ON")
    connection.execute("PRAGMA busy_timeout = 30000")
    try:
        yield connection
        connection.commit()
    except Exception:
        connection.rollback()
        raise
    finally:
        connection.close()


def initialize_database(db_path: Path | None = None) -> None:
    with connect(db_path) as connection:
        connection.execute("PRAGMA journal_mode = WAL")
        connection.executescript(
            """
            CREATE TABLE IF NOT EXISTS activities (
                activity_id INTEGER PRIMARY KEY,
                activity_name TEXT,
                start_time_local TEXT NOT NULL,
                distance REAL NOT NULL CHECK (distance >= 0),
                duration REAL NOT NULL CHECK (duration >= 0),
                average_speed REAL,
                average_hr REAL,
                max_hr REAL,
                calories REAL,
                elevation_gain REAL,
                raw_data TEXT NOT NULL,
                synced_at TEXT NOT NULL
            );

            CREATE INDEX IF NOT EXISTS idx_activities_start_time
            ON activities(start_time_local DESC);

            CREATE TABLE IF NOT EXISTS activity_hr_zones (
                activity_id INTEGER NOT NULL,
                zone_number INTEGER NOT NULL CHECK (zone_number BETWEEN 1 AND 5),
                seconds REAL NOT NULL CHECK (seconds >= 0),
                low_bpm REAL,
                high_bpm REAL,
                raw_data TEXT NOT NULL,
                synced_at TEXT NOT NULL,
                PRIMARY KEY (activity_id, zone_number),
                FOREIGN KEY (activity_id) REFERENCES activities(activity_id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS activity_hr_zone_sync (
                activity_id INTEGER PRIMARY KEY,
                status TEXT NOT NULL CHECK (status IN ('success', 'failed')),
                synced_at TEXT NOT NULL,
                error_message TEXT,
                FOREIGN KEY (activity_id) REFERENCES activities(activity_id) ON DELETE CASCADE
            );

            CREATE INDEX IF NOT EXISTS idx_activity_hr_zones_activity
            ON activity_hr_zones(activity_id);

            CREATE TABLE IF NOT EXISTS personal_records (
                record_key TEXT PRIMARY KEY,
                type_id INTEGER NOT NULL,
                activity_id INTEGER,
                distance_km REAL NOT NULL CHECK (distance_km > 0),
                duration REAL NOT NULL CHECK (duration >= 0),
                record_date TEXT NOT NULL,
                raw_data TEXT NOT NULL,
                synced_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS personal_record_history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                record_key TEXT NOT NULL,
                type_id INTEGER NOT NULL,
                activity_id INTEGER,
                distance_km REAL NOT NULL CHECK (distance_km > 0),
                duration REAL NOT NULL CHECK (duration >= 0),
                record_date TEXT NOT NULL,
                raw_data TEXT NOT NULL,
                observed_at TEXT NOT NULL,
                UNIQUE (record_key, activity_id, duration)
            );

            CREATE INDEX IF NOT EXISTS idx_personal_record_history_date
            ON personal_record_history(record_date);

            CREATE TABLE IF NOT EXISTS sync_runs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                source TEXT NOT NULL,
                status TEXT NOT NULL CHECK (status IN ('running', 'success', 'failed')),
                started_at TEXT NOT NULL,
                finished_at TEXT,
                inserted_count INTEGER NOT NULL DEFAULT 0,
                updated_count INTEGER NOT NULL DEFAULT 0,
                skipped_count INTEGER NOT NULL DEFAULT 0,
                hr_zone_count INTEGER NOT NULL DEFAULT 0,
                error_message TEXT
            );
            """
        )
        sync_run_columns = {
            row["name"] for row in connection.execute("PRAGMA table_info(sync_runs)").fetchall()
        }
        if "hr_zone_count" not in sync_run_columns:
            connection.execute(
                "ALTER TABLE sync_runs ADD COLUMN hr_zone_count INTEGER NOT NULL DEFAULT 0"
            )
        connection.execute(
            """
            INSERT OR IGNORE INTO personal_record_history (
                record_key, type_id, activity_id, distance_km, duration,
                record_date, raw_data, observed_at
            )
            SELECT record_key, type_id, activity_id, distance_km, duration,
                   record_date, raw_data, synced_at
            FROM personal_records
            """
        )
