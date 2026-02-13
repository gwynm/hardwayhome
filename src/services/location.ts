import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { openFreshDatabase } from '@/src/db/database';
import { getActiveWorkout, insertTrackpoint } from '@/src/db/queries';

export const BACKGROUND_LOCATION_TASK = 'background-location-task';

/**
 * Define the background location task at module scope.
 * This MUST execute on every JS initialization, including headless
 * background relaunches by iOS. It cannot be inside a component.
 */
TaskManager.defineTask(BACKGROUND_LOCATION_TASK, async ({ data, error }) => {
  if (error) {
    console.error('[BG Location] Task error:', error.message);
    return;
  }

  if (!data) return;

  const { locations } = data as { locations: Location.LocationObject[] };
  if (!locations || locations.length === 0) return;

  try {
    // Open a fresh DB connection — we may be in a separate headless JS context
    const db = openFreshDatabase();
    const activeWorkout = getActiveWorkout(db);

    if (!activeWorkout) {
      // No active workout — shouldn't normally happen, but defensive
      console.warn('[BG Location] No active workout, ignoring location update');
      return;
    }

    for (const location of locations) {
      insertTrackpoint(
        activeWorkout.id,
        location.coords.latitude,
        location.coords.longitude,
        location.coords.speed,
        location.coords.accuracy,
        db
      );
    }
  } catch (err) {
    console.error('[BG Location] Failed to write trackpoint:', err);
    // Don't throw — we never want the task to crash
  }
});

/**
 * Request location permissions (foreground then background).
 * Returns true if we have at least foreground permission.
 * Background permission is requested but not required — iOS may defer the
 * "upgrade to Always" prompt, and the user can grant it later in Settings.
 */
export async function requestLocationPermissions(): Promise<boolean> {
  const fg = await Location.requestForegroundPermissionsAsync();
  if (fg.status !== 'granted') return false;

  // Request background permission. On iOS, this may show a dialog to upgrade
  // to "Always", or iOS may defer it. Either way, don't block on it.
  try {
    await Location.requestBackgroundPermissionsAsync();
  } catch (err) {
    console.warn('[Location] Background permission request failed:', err);
  }

  return true;
}

/**
 * Check if we have background (Always) location permission.
 */
export async function hasBackgroundPermission(): Promise<boolean> {
  const bg = await Location.getBackgroundPermissionsAsync();
  return bg.status === 'granted';
}

/**
 * Start background location tracking for an active workout.
 */
export async function startBackgroundLocationTracking(): Promise<void> {
  const isRunning = await TaskManager.isTaskRegisteredAsync(BACKGROUND_LOCATION_TASK);
  if (isRunning) {
    console.log('[Location] Background task already running');
    return;
  }

  await Location.startLocationUpdatesAsync(BACKGROUND_LOCATION_TASK, {
    accuracy: Location.Accuracy.BestForNavigation,
    distanceInterval: 5, // metres — update every 5m of movement
    timeInterval: 3000,  // ms — or at least every 3 seconds
    showsBackgroundLocationIndicator: true, // blue bar on iOS
    foregroundService: {
      notificationTitle: 'Hard Way Home',
      notificationBody: 'Tracking your workout',
    },
    pausesUpdatesAutomatically: false,
    activityType: Location.ActivityType.Fitness,
  });

  console.log('[Location] Background tracking started');
}

/**
 * Stop background location tracking.
 */
export async function stopBackgroundLocationTracking(): Promise<void> {
  const isRunning = await TaskManager.isTaskRegisteredAsync(BACKGROUND_LOCATION_TASK);
  if (!isRunning) return;

  await Location.stopLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
  console.log('[Location] Background tracking stopped');
}

/**
 * Get the current location fix for status display (one-shot).
 */
export async function getCurrentLocation(): Promise<Location.LocationObject | null> {
  try {
    return await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.High,
    });
  } catch {
    return null;
  }
}

/**
 * Subscribe to foreground location updates (for GPS status indicator).
 * Returns an unsubscribe function.
 */
export async function watchLocation(
  callback: (location: Location.LocationObject) => void
): Promise<Location.LocationSubscription> {
  return await Location.watchPositionAsync(
    {
      accuracy: Location.Accuracy.High,
      distanceInterval: 1,
      timeInterval: 2000,
    },
    callback
  );
}
