import type { SQLiteDatabase } from 'expo-sqlite';
import { getDatabase } from './database';

// ─── Types ───────────────────────────────────────────────────────────

export type Workout = {
  id: number;
  started_at: string;
  finished_at: string | null;
  distance: number | null;
  avg_sec_per_km: number | null;
  avg_bpm: number | null;
};

export type Trackpoint = {
  id: number;
  workout_id: number;
  created_at: string;
  lat: number;
  lng: number;
  speed: number | null;
  err: number | null;
};

export type Pulse = {
  id: number;
  workout_id: number;
  created_at: string;
  bpm: number;
};

// ─── Workout queries ─────────────────────────────────────────────────

/** Get the currently active workout (started but not finished), if any. */
export function getActiveWorkout(db?: SQLiteDatabase): Workout | null {
  const d = db ?? getDatabase();
  return d.getFirstSync<Workout>(
    'SELECT * FROM workouts WHERE finished_at IS NULL ORDER BY started_at DESC LIMIT 1'
  );
}

/** Create a new workout and return its id. */
export function startWorkout(db?: SQLiteDatabase): number {
  const d = db ?? getDatabase();
  const now = new Date().toISOString();
  const result = d.runSync(
    'INSERT INTO workouts (started_at) VALUES (?)',
    now
  );
  return result.lastInsertRowId;
}

/** Finish a workout: set finished_at and compute cache fields. */
export function finishWorkout(workoutId: number, db?: SQLiteDatabase): void {
  const d = db ?? getDatabase();
  const now = new Date().toISOString();

  // Compute distance from trackpoints using JS haversine
  const trackpoints = getTrackpoints(workoutId, d);
  let distance = 0;
  for (let i = 1; i < trackpoints.length; i++) {
    distance += haversineMetres(
      trackpoints[i - 1].lat,
      trackpoints[i - 1].lng,
      trackpoints[i].lat,
      trackpoints[i].lng
    );
  }

  // Compute average pace
  let avgSecPerKm: number | null = null;
  if (distance > 0 && trackpoints.length >= 2) {
    const startTime = new Date(trackpoints[0].created_at).getTime();
    const endTime = new Date(trackpoints[trackpoints.length - 1].created_at).getTime();
    const totalSeconds = (endTime - startTime) / 1000;
    avgSecPerKm = totalSeconds / (distance / 1000);
  }

  // Compute average BPM
  const bpmResult = d.getFirstSync<{ avg_bpm: number | null }>(
    'SELECT AVG(bpm) as avg_bpm FROM pulses WHERE workout_id = ?',
    workoutId
  );

  d.runSync(
    `UPDATE workouts
     SET finished_at = ?, distance = ?, avg_sec_per_km = ?, avg_bpm = ?
     WHERE id = ?`,
    now,
    distance,
    avgSecPerKm,
    bpmResult?.avg_bpm ?? null,
    workoutId
  );
}

/** Delete a workout and all its trackpoints and pulses. */
export function deleteWorkout(workoutId: number, db?: SQLiteDatabase): void {
  const d = db ?? getDatabase();
  d.runSync('DELETE FROM pulses WHERE workout_id = ?', workoutId);
  d.runSync('DELETE FROM trackpoints WHERE workout_id = ?', workoutId);
  d.runSync('DELETE FROM workouts WHERE id = ?', workoutId);
}

/** Get all finished workouts, newest first. */
export function getWorkoutHistory(db?: SQLiteDatabase): Workout[] {
  const d = db ?? getDatabase();
  return d.getAllSync<Workout>(
    'SELECT * FROM workouts WHERE finished_at IS NOT NULL ORDER BY started_at DESC'
  );
}

// ─── Trackpoint queries ──────────────────────────────────────────────

/** Insert a trackpoint. Used by both foreground and background task. */
export function insertTrackpoint(
  workoutId: number,
  lat: number,
  lng: number,
  speed: number | null,
  err: number | null,
  db?: SQLiteDatabase
): void {
  const d = db ?? getDatabase();
  const now = new Date().toISOString();
  d.runSync(
    'INSERT INTO trackpoints (workout_id, created_at, lat, lng, speed, err) VALUES (?, ?, ?, ?, ?, ?)',
    workoutId,
    now,
    lat,
    lng,
    speed,
    err
  );
}

/** Get all trackpoints for a workout, ordered by time. */
export function getTrackpoints(
  workoutId: number,
  db?: SQLiteDatabase
): Trackpoint[] {
  const d = db ?? getDatabase();
  return d.getAllSync<Trackpoint>(
    'SELECT * FROM trackpoints WHERE workout_id = ? ORDER BY created_at ASC',
    workoutId
  );
}

/** Get trackpoints from the last N seconds for a workout. */
export function getRecentTrackpoints(
  workoutId: number,
  seconds: number,
  db?: SQLiteDatabase
): Trackpoint[] {
  const d = db ?? getDatabase();
  const cutoff = new Date(Date.now() - seconds * 1000).toISOString();
  return d.getAllSync<Trackpoint>(
    'SELECT * FROM trackpoints WHERE workout_id = ? AND created_at >= ? ORDER BY created_at ASC',
    workoutId,
    cutoff
  );
}

// ─── Pulse queries ───────────────────────────────────────────────────

/** Insert a heart rate pulse reading. */
export function insertPulse(
  workoutId: number,
  bpm: number,
  db?: SQLiteDatabase
): void {
  const d = db ?? getDatabase();
  const now = new Date().toISOString();
  d.runSync(
    'INSERT INTO pulses (workout_id, created_at, bpm) VALUES (?, ?, ?)',
    workoutId,
    now,
    bpm
  );
}

/** Get average BPM over the last N seconds for a workout. */
export function getRecentAvgBpm(
  workoutId: number,
  seconds: number,
  db?: SQLiteDatabase
): number | null {
  const d = db ?? getDatabase();
  const cutoff = new Date(Date.now() - seconds * 1000).toISOString();
  const result = d.getFirstSync<{ avg_bpm: number | null }>(
    'SELECT AVG(bpm) as avg_bpm FROM pulses WHERE workout_id = ? AND created_at >= ?',
    workoutId,
    cutoff
  );
  return result?.avg_bpm ?? null;
}

// ─── KV store ────────────────────────────────────────────────────────

export function kvGet(key: string, db?: SQLiteDatabase): string | null {
  const d = db ?? getDatabase();
  const result = d.getFirstSync<{ value: string }>(
    'SELECT value FROM kv WHERE key = ?',
    key
  );
  return result?.value ?? null;
}

export function kvSet(key: string, value: string, db?: SQLiteDatabase): void {
  const d = db ?? getDatabase();
  d.runSync(
    'INSERT OR REPLACE INTO kv (key, value) VALUES (?, ?)',
    key,
    value
  );
}

// ─── Haversine helper ────────────────────────────────────────────────

function haversineMetres(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371000; // Earth radius in metres
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
