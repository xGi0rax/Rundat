import os
import sqlite3
from contextlib import contextmanager
from pathlib import Path
from typing import Any, Iterable

from config import get_database_url, get_db_path


class DatabaseConnection:
    """Small DB-API compatibility layer for SQLite locally and PostgreSQL in production."""

    def __init__(self, connection: Any, dialect: str):
        self._connection = connection
        self.dialect = dialect

    def execute(self, statement: str, parameters: Iterable[Any] = ()):
        return self._connection.execute(
            _postgres_placeholders(statement) if self.dialect == "postgresql" else statement,
            tuple(parameters),
        )

    def executemany(self, statement: str, parameters: Iterable[Iterable[Any]]):
        query = _postgres_placeholders(statement) if self.dialect == "postgresql" else statement
        if self.dialect == "postgresql":
            cursor = self._connection.cursor()
            cursor.executemany(query, [tuple(values) for values in parameters])
            return cursor
        return self._connection.executemany(query, parameters)


def uses_postgres(db_path: Path | None = None) -> bool:
    return db_path is None and bool(get_database_url())


@contextmanager
def connect(db_path: Path | None = None):
    if uses_postgres(db_path):
        try:
            import psycopg
            from psycopg.rows import dict_row
        except ImportError as error:
            raise RuntimeError(
                "PostgreSQL richiede psycopg: installa le dipendenze del backend."
            ) from error

        connection = psycopg.connect(
            get_database_url(),
            row_factory=dict_row,
            prepare_threshold=None,
            connect_timeout=10,
            sslmode=os.getenv("DATABASE_SSLMODE", "require"),
        )
        wrapped = DatabaseConnection(connection, "postgresql")
    else:
        path = Path(db_path or get_db_path())
        path.parent.mkdir(parents=True, exist_ok=True)
        connection = sqlite3.connect(path, timeout=30)
        connection.row_factory = sqlite3.Row
        connection.execute("PRAGMA foreign_keys = ON")
        connection.execute("PRAGMA busy_timeout = 30000")
        wrapped = DatabaseConnection(connection, "sqlite")

    try:
        yield wrapped
        connection.commit()
    except Exception:
        connection.rollback()
        raise
    finally:
        connection.close()


def initialize_database(db_path: Path | None = None) -> None:
    statements = (
        _postgres_schema_statements()
        if uses_postgres(db_path)
        else _sqlite_schema_statements()
    )
    with connect(db_path) as connection:
        if connection.dialect == "sqlite":
            connection.execute("PRAGMA journal_mode = WAL")
        for statement in statements:
            connection.execute(statement)
        if connection.dialect == "sqlite":
            activity_columns = {
                row["name"]
                for row in connection.execute("PRAGMA table_info(activities)").fetchall()
            }
            if "activity_type" not in activity_columns:
                connection.execute(
                    "ALTER TABLE activities "
                    "ADD COLUMN activity_type TEXT NOT NULL DEFAULT 'running'"
                )
            sync_run_columns = {
                row["name"]
                for row in connection.execute("PRAGMA table_info(sync_runs)").fetchall()
            }
            if "hr_zone_count" not in sync_run_columns:
                connection.execute(
                    "ALTER TABLE sync_runs "
                    "ADD COLUMN hr_zone_count INTEGER NOT NULL DEFAULT 0"
                )
        else:
            connection.execute(
                "ALTER TABLE activities "
                "ADD COLUMN IF NOT EXISTS activity_type TEXT NOT NULL DEFAULT 'running'"
            )
            connection.execute(
                "ALTER TABLE sync_runs "
                "ADD COLUMN IF NOT EXISTS hr_zone_count INTEGER NOT NULL DEFAULT 0"
            )
        connection.execute(
            """
            INSERT INTO personal_record_history (
                record_key, type_id, activity_id, distance_km, duration,
                record_date, raw_data, observed_at
            )
            SELECT record_key, type_id, activity_id, distance_km, duration,
                   record_date, raw_data, synced_at
            FROM personal_records
            WHERE true
            ON CONFLICT (record_key, activity_id, duration) DO NOTHING
            """
        )


def _postgres_placeholders(statement: str) -> str:
    return statement.replace("?", "%s")


def _common_schema_statements(sync_run_id: str) -> tuple[str, ...]:
    return (
        """
        CREATE TABLE IF NOT EXISTS activities (
            activity_id BIGINT PRIMARY KEY,
            activity_name TEXT,
            activity_type TEXT NOT NULL DEFAULT 'running'
                CHECK (activity_type IN ('running', 'cycling')),
            start_time_local TEXT NOT NULL,
            distance DOUBLE PRECISION NOT NULL CHECK (distance >= 0),
            duration DOUBLE PRECISION NOT NULL CHECK (duration >= 0),
            average_speed DOUBLE PRECISION,
            average_hr DOUBLE PRECISION,
            max_hr DOUBLE PRECISION,
            calories DOUBLE PRECISION,
            elevation_gain DOUBLE PRECISION,
            raw_data TEXT NOT NULL,
            synced_at TEXT NOT NULL
        )
        """,
        """
        CREATE INDEX IF NOT EXISTS idx_activities_start_time
        ON activities(start_time_local DESC)
        """,
        """
        CREATE TABLE IF NOT EXISTS activity_hr_zones (
            activity_id BIGINT NOT NULL,
            zone_number INTEGER NOT NULL CHECK (zone_number BETWEEN 1 AND 5),
            seconds DOUBLE PRECISION NOT NULL CHECK (seconds >= 0),
            low_bpm DOUBLE PRECISION,
            high_bpm DOUBLE PRECISION,
            raw_data TEXT NOT NULL,
            synced_at TEXT NOT NULL,
            PRIMARY KEY (activity_id, zone_number),
            FOREIGN KEY (activity_id) REFERENCES activities(activity_id) ON DELETE CASCADE
        )
        """,
        """
        CREATE TABLE IF NOT EXISTS activity_hr_zone_sync (
            activity_id BIGINT PRIMARY KEY,
            status TEXT NOT NULL CHECK (status IN ('success', 'failed')),
            synced_at TEXT NOT NULL,
            error_message TEXT,
            FOREIGN KEY (activity_id) REFERENCES activities(activity_id) ON DELETE CASCADE
        )
        """,
        """
        CREATE INDEX IF NOT EXISTS idx_activity_hr_zones_activity
        ON activity_hr_zones(activity_id)
        """,
        """
        CREATE TABLE IF NOT EXISTS personal_records (
            record_key TEXT PRIMARY KEY,
            type_id INTEGER NOT NULL,
            activity_id BIGINT,
            distance_km DOUBLE PRECISION NOT NULL CHECK (distance_km > 0),
            duration DOUBLE PRECISION NOT NULL CHECK (duration >= 0),
            record_date TEXT NOT NULL,
            raw_data TEXT NOT NULL,
            synced_at TEXT NOT NULL
        )
        """,
        f"""
        CREATE TABLE IF NOT EXISTS personal_record_history (
            id {sync_run_id},
            record_key TEXT NOT NULL,
            type_id INTEGER NOT NULL,
            activity_id BIGINT,
            distance_km DOUBLE PRECISION NOT NULL CHECK (distance_km > 0),
            duration DOUBLE PRECISION NOT NULL CHECK (duration >= 0),
            record_date TEXT NOT NULL,
            raw_data TEXT NOT NULL,
            observed_at TEXT NOT NULL,
            UNIQUE (record_key, activity_id, duration)
        )
        """,
        """
        CREATE INDEX IF NOT EXISTS idx_personal_record_history_date
        ON personal_record_history(record_date)
        """,
        f"""
        CREATE TABLE IF NOT EXISTS sync_runs (
            id {sync_run_id},
            source TEXT NOT NULL,
            status TEXT NOT NULL CHECK (status IN ('running', 'success', 'failed')),
            started_at TEXT NOT NULL,
            finished_at TEXT,
            inserted_count INTEGER NOT NULL DEFAULT 0,
            updated_count INTEGER NOT NULL DEFAULT 0,
            skipped_count INTEGER NOT NULL DEFAULT 0,
            hr_zone_count INTEGER NOT NULL DEFAULT 0,
            error_message TEXT
        )
        """,
        """
        CREATE TABLE IF NOT EXISTS garmin_token_store (
            store_key TEXT PRIMARY KEY,
            token_bundle TEXT NOT NULL,
            updated_at TEXT NOT NULL
        )
        """,
    )


def _sqlite_schema_statements() -> tuple[str, ...]:
    return _common_schema_statements("INTEGER PRIMARY KEY AUTOINCREMENT")


def _postgres_schema_statements() -> tuple[str, ...]:
    statements = list(_common_schema_statements("BIGSERIAL PRIMARY KEY"))
    if os.getenv("RUNDAT_ENABLE_RLS", "true").lower() not in {"0", "false", "no"}:
        statements.extend(
            f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY"
            for table in (
                "activities",
                "activity_hr_zones",
                "activity_hr_zone_sync",
                "personal_records",
                "personal_record_history",
                "sync_runs",
                "garmin_token_store",
            )
        )
    return tuple(statements)
