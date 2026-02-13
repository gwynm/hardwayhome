import { useState, useEffect, useCallback } from 'react';
import { router } from 'expo-router';
import {
  getActiveWorkout,
  startWorkout,
  finishWorkout,
  deleteWorkout,
  type Workout,
} from '@/src/db/queries';
import {
  requestLocationPermissions,
  startBackgroundLocationTracking,
  stopBackgroundLocationTracking,
} from '@/src/services/location';
import { setActiveWorkoutId } from '@/src/services/heartrate';
import { backupDatabase } from '@/src/services/backup';

/**
 * Central hook for workout start/stop/resume lifecycle.
 * Coordinates background location, BLE, and database state.
 */
export function useWorkoutRecording() {
  const [activeWorkout, setActiveWorkout] = useState<Workout | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // On mount, check for an active workout
  useEffect(() => {
    const workout = getActiveWorkout();
    setActiveWorkout(workout);

    if (workout) {
      // Resume: ensure background tracking is running, set BLE workout ID
      setActiveWorkoutId(workout.id);
      startBackgroundLocationTracking().catch(console.error);
    }

    setIsLoading(false);
  }, []);

  const start = useCallback(async () => {
    // Ensure permissions
    const hasPermission = await requestLocationPermissions();
    if (!hasPermission) {
      // TODO: show alert about needing location permissions
      console.error('[Workout] Location permission denied');
      return;
    }

    // Create workout in DB
    const workoutId = startWorkout();
    const workout = getActiveWorkout();
    setActiveWorkout(workout);

    // Start background services
    setActiveWorkoutId(workoutId);
    await startBackgroundLocationTracking();

    // Navigate to workout screen
    router.push('/workout');
  }, []);

  const finish = useCallback(async () => {
    if (!activeWorkout) return;

    // Stop background services
    await stopBackgroundLocationTracking();
    setActiveWorkoutId(null);

    // Compute cache fields and finalize
    finishWorkout(activeWorkout.id);
    setActiveWorkout(null);

    // Backup (non-blocking, non-fatal)
    backupDatabase().catch(console.error);

    // Navigate home
    router.replace('/');
  }, [activeWorkout]);

  const discard = useCallback(async () => {
    if (!activeWorkout) return;

    // Stop background services
    await stopBackgroundLocationTracking();
    setActiveWorkoutId(null);

    // Delete the workout and all its data
    deleteWorkout(activeWorkout.id);
    setActiveWorkout(null);

    // Navigate home
    router.replace('/');
  }, [activeWorkout]);

  return {
    activeWorkout,
    isLoading,
    start,
    finish,
    discard,
  };
}
