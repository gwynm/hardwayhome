
## More info

(Partially written by robots below this point)

### Tech

- **Framework**: Expo SDK 54, TypeScript, Expo Router
- **Database**: expo-sqlite (WAL mode)
- **GPS**: expo-location + expo-task-manager (background tracking)
- **Heart Rate**: react-native-ble-plx (BLE HRM, background mode)
- **Backup**: WebDAV (HTTP PUT to user-configured server, local fallback via expo-file-system)

Requires a development build — Expo Go won't work due to BLE native modules.

### Data Model

No user login. All data is local SQLite.

**Workouts**
- id, started_at, finished_at
- Cache fields (computed on finish): distance (m), avg_sec_per_km, avg_bpm

**Trackpoints** (GPS location samples)
- id, workout_id, created_at, lat, lng, speed, err

**Pulses** (heart rate samples)
- id, workout_id, created_at, bpm

**KV** (app settings)
- key, value (stores connected BLE device ID, etc.)

### Architecture

SQLite is the single source of truth. The app is a UI layer on top of the database — all workout state lives in SQL, never in React state. This is critical for reliability.

#### Background Tracking

During a workout, two systems write data independently:

1. **GPS (expo-location + TaskManager)**: Runs via iOS `location` background mode. The TaskManager callback runs in a separate headless JS context, opens its own SQLite connection, queries for the active workout, and inserts trackpoints. If iOS kills the app, it relaunches it in the background for each new location event.

2. **BLE Heart Rate (react-native-ble-plx)**: Runs via iOS `bluetooth-central` background mode. Characteristic notifications fire in the main JS context and write pulses to SQLite. Uses state restoration for reconnection after app termination.

The Workout screen polls SQLite at ~1Hz to compute live stats.

#### Workout Resume

A workout is "active" if `started_at IS NOT NULL AND finished_at IS NULL`. On every app launch, the root layout checks for an active workout and navigates directly to the Workout screen if one exists. Background tracking is re-started if not already running, and BLE reconnection is attempted using the stored device ID.

#### Known Limitations

- **Force-quit**: If the user swipes the app away in the app switcher, iOS stops all background activity. Data has a gap until the app is reopened.
- **Low Power Mode**: iOS may reduce background location frequency.
- **BLE reliability**: Less reliable than GPS in background. HR data may have gaps after disconnections. The app tolerates this gracefully.

### BLE Heart Rate Monitors

#### Do I need to pair in iOS Bluetooth settings?

No. BLE (Bluetooth Low Energy) heart rate monitors like Polar Sense / Verity Sense / H10, Garmin HRM-Dual, Wahoo TICKR, etc. do **not** need to be paired at the OS level. In fact, **you should not pair them in Settings > Bluetooth**.

BLE devices work differently from Classic Bluetooth devices (headphones, speakers). Classic Bluetooth needs OS-level pairing to establish an encrypted bond. BLE HR monitors advertise openly — any app can scan for them and connect directly. No pairing or bonding is needed.

If you do pair a BLE HRM in iOS Settings, iOS may hold onto the connection and interfere with apps trying to connect. If you're having trouble, go to Settings > Bluetooth, find the device, tap the (i) button, and choose "Forget This Device", then connect from within the app.

#### How connection works in this app

1. **Tap the heart icon** (red ✕ = disconnected) on either the home screen or workout screen
2. The BLE picker opens and **scans for HR monitors** broadcasting the standard Heart Rate Service (UUID 0x180D)
3. Tap a device to connect. The app subscribes to HR notifications and starts receiving BPM
4. The device ID is **saved locally** so the app can auto-reconnect on future launches

#### Can other apps interfere?

No. iOS proxies all BLE connections through CoreBluetooth. The OS maintains a single physical connection to the peripheral and multiplexes it to every app that requests access. From the HR monitor's perspective, there is only one connection — iOS handles the fan-out internally. So this app, Strava, Peloton, etc. can all receive HR data from the same device simultaneously without conflict.

The only scenario where connection limits matter is **cross-device**: e.g., an iPhone and an Android phone (or a Garmin watch acting as its own BLE central) both trying to connect to the same HR strap. Most modern HRMs support 2–3 concurrent physical connections, so even this is rarely an issue.

#### What if the monitor disconnects mid-workout?

The app auto-reconnects every 10 seconds for up to 5 minutes. Pulse data will have a gap for the disconnected period. GPS tracking is unaffected — it runs independently.

### Features

#### Home Screen

- GPS status indicator (red/yellow/green based on accuracy)
- Heart rate monitor status (tap to open BLE device picker)
- Backup status indicator (grey=not configured, yellow=uploading, green=ok, red=failed; tap to open settings)
- Settings gear button (top-right)
- Start button
- Workout history table: Date, Distance, Av Pace, Av BPM

#### Workout In Progress Screen

Live stats grid (polled at 1Hz):
- Distance / Time
- Pace (100m) / Pace (1km) — min:sec per km
- BPM (5s) / BPM (60s) — averaged over window

Stop button → confirmation: "Finish & Save", "Finish & Delete", "Cancel"

#### Settings

Accessible via the gear icon on the home screen. Configures remote backup:

- **WebDAV URL**: Full URL including path, e.g. `https://mywebdav.example/hardwayhome/backups`
- **Username**: WebDAV username (HTTP Basic auth)
- **Password**: WebDAV password
- **Test Connection**: Sends an OPTIONS request to verify the server responds
- Settings are stored in the SQLite KV table and persist across app restarts

#### Backup

After each workout, the SQLite database is backed up in two ways:

1. **Local**: Always copies to the app's Documents directory (Files.app → On My iPhone → Hard Way Home → backups/). The last 10 backups are kept.

2. **Remote (WebDAV)**: If configured in Settings, uploads the database via HTTP PUT to the configured URL. The filename is `hardwayhome-{timestamp}.sqlite`.

The backup status indicator on the home and workout screens shows:
- Grey (`☁ --`): WebDAV not configured
- Yellow (`☁ ...`): Upload in progress
- Green (`☁ ✓`): Last backup succeeded
- Red (`☁ ✕`): Last backup failed

Backups are `.sqlite` files. Open them with any SQLite client (`sqlite3`, DB Browser for SQLite, TablePlus, etc.).

##### Server setup

Any WebDAV server that accepts HTTP PUT with Bearer token auth will work. Examples:

- Apache with `mod_dav` + `mod_authn_bearer`
- Nginx with `dav_ext_module`
- `rclone serve webdav`
- Nextcloud/ownCloud (built-in WebDAV)

### Development

```bash
# Install dependencies
npm install

# Start Expo dev server
npm start

# Build and run on connected iOS device
npm run ios:device
```

#### Distribution

```bash
# Test, build, and install on connected device
./scripts/deploy.sh
```

Requires: Mac, USB cable, Apple Developer account, device registered in provisioning profile.

### Project Structure

```
app/
  _layout.tsx              Root layout, DB init, workout resume, task registration
  index.tsx                Home screen
  workout.tsx              Workout in progress screen
  settings.tsx             Settings screen (WebDAV backup config)

src/
  db/
    database.ts            DB connection, WAL mode, migrations
    schema.ts              CREATE TABLE statements
    queries.ts             Typed read/write functions
  services/
    location.ts            Background location task + foreground tracking
    heartrate.ts           BLE scan, connect, HR notifications, state restoration
    backup.ts              WebDAV upload + local backup + status tracking
  hooks/
    useGpsStatus.ts        GPS fix quality (red/yellow/green)
    useHeartRate.ts        BLE connection state + live BPM
    useBackupStatus.ts     Backup status (listener pattern)
    useWorkoutRecording.ts Start/stop/resume orchestration
    useWorkoutStats.ts     Live stats from SQLite polling
  components/
    GpsStatus.tsx          GPS status pill
    HrStatus.tsx           HR status pill
    BackupStatus.tsx       Backup status pill
    BleDevicePicker.tsx    Modal: scan + connect HRM
    WorkoutHistory.tsx     Scrollable workout table
    LiveStats.tsx          2x3 stat grid
  utils/
    distance.ts            Haversine formula
    pace.ts                Pace over distance window
    format.ts              Formatting helpers

scripts/
  deploy.sh               Test + build + install
```
