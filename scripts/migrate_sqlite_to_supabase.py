import argparse
import os
import sqlite3
import sys
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parents[1]
BACKEND_DIR = ROOT_DIR / "backend"
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from services.database import connect, initialize_database  # noqa: E402
from services.garmin_token_repository import save_token_directory  # noqa: E402

TABLES = {
    "activities": ("activity_id",),
    "activity_hr_zones": ("activity_id", "zone_number"),
    "activity_hr_zone_sync": ("activity_id",),
    "personal_records": ("record_key",),
    "personal_record_history": ("record_key", "activity_id", "duration"),
}


def migrate(source_path: Path, token_directory: Path | None) -> None:
    if not os.getenv("DATABASE_URL"):
        raise SystemExit("Imposta DATABASE_URL prima di eseguire la migrazione.")
    if not source_path.exists():
        raise SystemExit(f"Database SQLite non trovato: {source_path}")

    initialize_database()
    source = sqlite3.connect(source_path)
    source.row_factory = sqlite3.Row
    try:
        with connect() as target:
            for table, conflict_columns in TABLES.items():
                rows = source.execute(f"SELECT * FROM {table}").fetchall()
                if not rows:
                    print(f"{table}: 0 righe")
                    continue
                columns = tuple(column for column in rows[0].keys() if column != "id")
                placeholders = ", ".join("?" for _ in columns)
                column_list = ", ".join(columns)
                conflict = ", ".join(conflict_columns)
                update_columns = [
                    column for column in columns if column not in conflict_columns and column != "id"
                ]
                update_clause = ", ".join(
                    f"{column} = excluded.{column}" for column in update_columns
                )
                statement = (
                    f"INSERT INTO {table} ({column_list}) VALUES ({placeholders}) "
                    f"ON CONFLICT ({conflict}) "
                    + (f"DO UPDATE SET {update_clause}" if update_clause else "DO NOTHING")
                )
                target.executemany(statement, [tuple(row[column] for column in columns) for row in rows])
                print(f"{table}: {len(rows)} righe migrate")
    finally:
        source.close()

    if token_directory and token_directory.exists():
        save_token_directory(token_directory)
        print("Sessione Garmin migrata")


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Migra i dati locali Rundat da SQLite a Supabase PostgreSQL."
    )
    parser.add_argument(
        "--source",
        type=Path,
        default=BACKEND_DIR / "rundat.db",
        help="Percorso del database SQLite locale.",
    )
    parser.add_argument(
        "--token-directory",
        type=Path,
        default=BACKEND_DIR / ".garminconnect",
        help="Directory locale dei token Garmin.",
    )
    arguments = parser.parse_args()
    migrate(arguments.source.resolve(), arguments.token_directory.resolve())


if __name__ == "__main__":
    main()
