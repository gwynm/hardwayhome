/** SQL statements for creating and migrating the database schema. */

export const SCHEMA_VERSION = 1;

export const CREATE_TABLES = `
  CREATE TABLE IF NOT EXISTS workouts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    started_at TEXT NOT NULL,
    finished_at TEXT,
    distance REAL,
    avg_sec_per_km REAL,
    avg_bpm REAL
  );

  CREATE TABLE IF NOT EXISTS trackpoints (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    workout_id INTEGER NOT NULL,
    created_at TEXT NOT NULL,
    lat REAL NOT NULL,
    lng REAL NOT NULL,
    speed REAL,
    err REAL,
    FOREIGN KEY (workout_id) REFERENCES workouts(id)
  );

  CREATE TABLE IF NOT EXISTS pulses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    workout_id INTEGER NOT NULL,
    created_at TEXT NOT NULL,
    bpm INTEGER NOT NULL,
    FOREIGN KEY (workout_id) REFERENCES workouts(id)
  );

  CREATE TABLE IF NOT EXISTS kv (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_trackpoints_workout ON trackpoints(workout_id, created_at);
  CREATE INDEX IF NOT EXISTS idx_pulses_workout ON pulses(workout_id, created_at);
`;
