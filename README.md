# Hard Way Home

This is a personal fitness tracker application for iOS. It prioritises simplicity and reliability.

## Tech 

We use Typescript and Expo. We'll probably need a development build because we'll need native extensions for the heart rate monitoring.

We use SQLite for storage.

## Data Model

There's no user login or anything. We have:

Workouts
 * id
 * started_at
 * finished_at
(cache fields, derivable from trackpoints/pulses but useful for simplicity: )
 - distance (m)
 - avg_sec_per_km
 - avg_bpm

Trackpoints (track location)
 * id
 * workout_id
 * created_at
 * lat
 * lng
 * speed (as reported by gps)
 * err (expected error, metres)

Pulses (track heart rate)
 * id
 * workout_id
 * created_at
 * bpm (heart rate)


## Distribution

This is a personal application so we don't need to think about App Store submission or anything, just a way to get it onto a single device. We need a single script that tests, builds, and then installs on iOS (via cable, or by presenting a URL for the user to visit with the phone, or via testflight update, or something)


## Features

We have two screens: "Home", and "Workout In Progress"

### Home Screen

Show GPS status (red - no position fix or accuracy > 50m, yellow - accuracy > 10m, green: OK) and heart rate monitor status (red X, or green current BPM - we're not recording BPM at this stage, just showing it).

Tapping on the heart rate monitor status should open an interface to select/connect a BLE heart rate monitor.

Below this, show a Start button.

Below that, show a table (newest on top, scroll the screen if needed):
Date     Distance   Av Pace   Av BPM
[workouts here]

Av Pace is average pace, like 6:20 (min:sec per km). 
Av BPM is average heart rate across the workout.

### Workout In Progress Screen

We show a table:

Distance:  1.23 km         Time:  1:23:45
Pace (100m):   6:23        Pace (1000m): 5:15
BPM (5s):     120          BPM (60s):   130

Pace is min:sec to cover 1km, derived from either the last 100m of travel, or the last 1000m of travel. BPM is averaged over 5sec, and over 60sec.


Below this, have a Stop button. This shows a confirmation prompt with "Finish and Save", "Finish Delete", "Cancel".

When stopped, we return to the home screen, where the new workout is immediately shown at the top of the table.


### Backup

We perform a backup (snapshot the database to an .sqlite file) to iCloud Documents after each workout is saved. There's no way to 'restore' this back into the app yet, but it does give the user access to the data on a real computer (via iCloud document sync -> open .sqlite file on desktop).
