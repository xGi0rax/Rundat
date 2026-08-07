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
);

ALTER TABLE activities
ADD COLUMN IF NOT EXISTS activity_type TEXT NOT NULL DEFAULT 'running';

CREATE INDEX IF NOT EXISTS idx_activities_start_time
ON activities(start_time_local DESC);

CREATE TABLE IF NOT EXISTS activity_hr_zones (
    activity_id BIGINT NOT NULL REFERENCES activities(activity_id) ON DELETE CASCADE,
    zone_number INTEGER NOT NULL CHECK (zone_number BETWEEN 1 AND 5),
    seconds DOUBLE PRECISION NOT NULL CHECK (seconds >= 0),
    low_bpm DOUBLE PRECISION,
    high_bpm DOUBLE PRECISION,
    raw_data TEXT NOT NULL,
    synced_at TEXT NOT NULL,
    PRIMARY KEY (activity_id, zone_number)
);

CREATE TABLE IF NOT EXISTS activity_hr_zone_sync (
    activity_id BIGINT PRIMARY KEY REFERENCES activities(activity_id) ON DELETE CASCADE,
    status TEXT NOT NULL CHECK (status IN ('success', 'failed')),
    synced_at TEXT NOT NULL,
    error_message TEXT
);

CREATE INDEX IF NOT EXISTS idx_activity_hr_zones_activity
ON activity_hr_zones(activity_id);

CREATE TABLE IF NOT EXISTS personal_records (
    record_key TEXT PRIMARY KEY,
    type_id INTEGER NOT NULL,
    activity_id BIGINT,
    distance_km DOUBLE PRECISION NOT NULL CHECK (distance_km > 0),
    duration DOUBLE PRECISION NOT NULL CHECK (duration >= 0),
    record_date TEXT NOT NULL,
    raw_data TEXT NOT NULL,
    synced_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS personal_record_history (
    id BIGSERIAL PRIMARY KEY,
    record_key TEXT NOT NULL,
    type_id INTEGER NOT NULL,
    activity_id BIGINT,
    distance_km DOUBLE PRECISION NOT NULL CHECK (distance_km > 0),
    duration DOUBLE PRECISION NOT NULL CHECK (duration >= 0),
    record_date TEXT NOT NULL,
    raw_data TEXT NOT NULL,
    observed_at TEXT NOT NULL,
    UNIQUE (record_key, activity_id, duration)
);

CREATE INDEX IF NOT EXISTS idx_personal_record_history_date
ON personal_record_history(record_date);

CREATE TABLE IF NOT EXISTS sync_runs (
    id BIGSERIAL PRIMARY KEY,
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

CREATE TABLE IF NOT EXISTS garmin_token_store (
    store_key TEXT PRIMARY KEY,
    token_bundle TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

ALTER TABLE activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_hr_zones ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_hr_zone_sync ENABLE ROW LEVEL SECURITY;
ALTER TABLE personal_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE personal_record_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE garmin_token_store ENABLE ROW LEVEL SECURITY;

-- Non vengono create policy per anon/authenticated: le tabelle restano invisibili
-- dalle API pubbliche Supabase. Rundat accede soltanto tramite la connessione
-- PostgreSQL server-side configurata su Vercel.
