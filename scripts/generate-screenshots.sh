#!/bin/bash
# Generates app screenshots by seeding the simulator DB with fixture data,
# then launching the app and capturing each screen.
#
# Prerequisites:
#   - iOS simulator booted (e.g. "iPhone 16 Pro")
#   - App installed in the simulator (run 'npx expo run:ios --device "iPhone 16 Pro"' first)
#   - python3 available
#
# Usage: bash scripts/generate-screenshots.sh
set -euo pipefail

BUNDLE_ID="com.gwynmorfey.hardwayhome.app"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
SCREENSHOTS_DIR="$PROJECT_DIR/assets/screenshots"

echo "=== Hard Way Home: Generate Screenshots ==="
echo ""

# --- Preflight checks ---

if ! xcrun simctl list devices booted 2>/dev/null | grep -q "Booted"; then
  echo "ERROR: No simulator is booted."
  echo "  Boot one with: xcrun simctl boot 'iPhone 16 Pro'"
  exit 1
fi

DATA_DIR=$(xcrun simctl get_app_container booted "$BUNDLE_ID" data 2>/dev/null) || {
  echo "ERROR: App not installed in simulator."
  echo "  Install with: npx expo run:ios --device 'iPhone 16 Pro'"
  exit 1
}

DB_PATH="$DATA_DIR/Documents/SQLite/hardwayhome.db"

if [ ! -f "$DB_PATH" ]; then
  echo "ERROR: Database not found at $DB_PATH"
  echo "  Launch the app once first to create the database."
  exit 1
fi

mkdir -p "$SCREENSHOTS_DIR"

# --- Helper functions ---

terminate_app() {
  xcrun simctl terminate booted "$BUNDLE_ID" 2>/dev/null || true
  sleep 1
}

launch_app() {
  xcrun simctl launch booted "$BUNDLE_ID" >/dev/null 2>&1
  sleep 5  # Wait for app to fully load
}

screenshot() {
  local name=$1
  sleep 2
  xcrun simctl io booted screenshot "$SCREENSHOTS_DIR/$name" >/dev/null 2>&1
  echo "  Captured $name"
}

set_nav() {
  local route=$1
  sqlite3 "$DB_PATH" "INSERT OR REPLACE INTO kv(key,value) VALUES('screenshot_nav','$route');"
}

clear_nav() {
  sqlite3 "$DB_PATH" "DELETE FROM kv WHERE key = 'screenshot_nav';"
}

# --- Seed fixture data ---

echo "--- Seeding fixture data ---"
terminate_app

python3 << 'PYEOF' | sqlite3 "$DB_PATH"
import math, datetime, random

random.seed(42)  # Deterministic output

# --- Route generation ---

LAT_DEG_PER_M = 1.0 / 111320.0

def lng_deg_per_m(lat):
    return 1.0 / (111320.0 * math.cos(math.radians(lat)))

def gen_route(start_lat, start_lng, bearing_deg, total_m, speed_mps, interval_s):
    """Generate (lat, lng) points along a straight bearing with slight jitter."""
    step_dist = speed_mps * interval_s
    n = int(total_m / step_dist)
    bearing = math.radians(bearing_deg)
    points = []
    lat, lng = start_lat, start_lng
    for i in range(n + 1):
        jitter_lat = random.uniform(-0.000003, 0.000003)
        jitter_lng = random.uniform(-0.000003, 0.000003)
        points.append((lat + jitter_lat, lng + jitter_lng))
        lat += step_dist * math.cos(bearing) * LAT_DEG_PER_M
        lng += step_dist * math.sin(bearing) * lng_deg_per_m(lat)
    return points

def iso(dt):
    return dt.strftime('%Y-%m-%dT%H:%M:%S.000Z')

# --- Define workouts ---

# Workout 1: Finished, ~5.2km heading NE from King's Cross
r1 = gen_route(51.5310, -0.1235, bearing_deg=50, total_m=5200, speed_mps=3.0, interval_s=10)
w1_start = datetime.datetime(2026, 2, 13, 11, 30, 0)

# Workout 2: Finished, ~2.8km heading E from Bloomsbury
r2 = gen_route(51.5280, -0.1300, bearing_deg=80, total_m=2800, speed_mps=2.8, interval_s=10)
w2_start = datetime.datetime(2026, 2, 12, 7, 15, 0)

# Workout 3: Active (in progress), ~1.5km heading NNE — started recently
r3 = gen_route(51.5320, -0.1250, bearing_deg=30, total_m=1500, speed_mps=3.2, interval_s=10)
now = datetime.datetime.now(datetime.timezone.utc).replace(tzinfo=None)
w3_start = now - datetime.timedelta(seconds=len(r3) * 10 + 30)  # +30s buffer

# Finish times for completed workouts
w1_finish = w1_start + datetime.timedelta(seconds=len(r1) * 10)
w2_finish = w2_start + datetime.timedelta(seconds=len(r2) * 10)

# --- Generate SQL ---

print("BEGIN TRANSACTION;")
print()
print("DELETE FROM trackpoints;")
print("DELETE FROM pulses;")
print("DELETE FROM workouts;")
print("DELETE FROM kv WHERE key = 'screenshot_nav';")
print()

# Workout rows
print(f"INSERT INTO workouts(id, started_at, finished_at, distance, avg_sec_per_km, avg_bpm)")
print(f"VALUES(1, '{iso(w1_start)}', '{iso(w1_finish)}', 5200, 345, 142);")
print(f"INSERT INTO workouts(id, started_at, finished_at, distance, avg_sec_per_km, avg_bpm)")
print(f"VALUES(2, '{iso(w2_start)}', '{iso(w2_finish)}', 2800, 372, 128);")
print(f"INSERT INTO workouts(id, started_at)")
print(f"VALUES(3, '{iso(w3_start)}');")
print()

# Trackpoints and pulses
def emit_data(workout_id, points, start_dt, interval_s, base_bpm, bpm_rise):
    for i, (lat, lng) in enumerate(points):
        t = start_dt + datetime.timedelta(seconds=i * interval_s)
        err = round(random.uniform(5.0, 15.0), 1)
        speed = round(random.uniform(2.5, 4.0), 1)
        print(f"INSERT INTO trackpoints(workout_id, created_at, lat, lng, speed, err) "
              f"VALUES({workout_id}, '{iso(t)}', {lat:.7f}, {lng:.7f}, {speed}, {err});")
        bpm = int(base_bpm + (bpm_rise * i / max(len(points) - 1, 1)) + random.uniform(-5, 5))
        bpm = max(100, min(185, bpm))
        print(f"INSERT INTO pulses(workout_id, created_at, bpm) "
              f"VALUES({workout_id}, '{iso(t)}', {bpm});")

emit_data(1, r1, w1_start, 10, 120, 35)   # HR 120→155
emit_data(2, r2, w2_start, 10, 115, 20)    # HR 115→135
emit_data(3, r3, w3_start, 10, 125, 25)    # HR 125→150

print()
print("COMMIT;")
PYEOF

echo "  Seeded 3 workouts with trackpoints and pulse data"
echo ""

# --- Capture screenshots ---

# 1. Workout in progress (active workout triggers auto-navigation to /workout)
echo "--- Screenshot: workout (in progress) ---"
clear_nav
launch_app
screenshot "workout.png"

# 2. Home screen (finish the active workout, no nav flag)
echo "--- Screenshot: home ---"
terminate_app
# Finish workout 3 so all workouts appear in history
sqlite3 "$DB_PATH" "UPDATE workouts SET finished_at = datetime(started_at, '+' || (SELECT count(*) * 10 FROM trackpoints WHERE workout_id = 3) || ' seconds'), distance = 1500, avg_sec_per_km = 313, avg_bpm = 145 WHERE id = 3;"
clear_nav
launch_app
screenshot "home.png"

# 3. Workout detail (navigate via screenshot_nav flag)
echo "--- Screenshot: workout-detail ---"
terminate_app
set_nav "/workout-detail?id=1"
launch_app
screenshot "workout-detail.png"

# 4. Settings
echo "--- Screenshot: settings ---"
terminate_app
set_nav "/settings"
launch_app
screenshot "settings.png"

# --- Cleanup ---
terminate_app
clear_nav

echo ""
echo "=== Done! Screenshots saved to $SCREENSHOTS_DIR ==="
ls -lh "$SCREENSHOTS_DIR"/*.png
