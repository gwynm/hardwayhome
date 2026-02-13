import { useState, useEffect, useRef } from 'react';
import {
  getTrackpoints,
  getPulses,
  getRecentAvgBpm,
  type Trackpoint,
} from '@/src/db/queries';
import { paceOverWindow, trackpointDistance } from '@/src/utils/pace';
import { filterReliableTrackpoints } from '@/src/utils/trackpointFilter';
import { computeKmSplits, type KmSplit } from '@/src/utils/splits';

export type WorkoutStats = {
  distance: number; // metres
  elapsedSeconds: number;
  pace100m: number | null; // sec per km, from last 100m
  pace1000m: number | null; // sec per km, from last 1000m
  bpm5s: number | null;
  bpm60s: number | null;
  trackpoints: Trackpoint[]; // filtered reliable trackpoints
  splits: KmSplit[];
};

const EMPTY_STATS: WorkoutStats = {
  distance: 0,
  elapsedSeconds: 0,
  pace100m: null,
  pace1000m: null,
  bpm5s: null,
  bpm60s: null,
  trackpoints: [],
  splits: [],
};

/**
 * Polls SQLite at ~1Hz and computes live workout stats.
 * Only active when workoutId is provided.
 */
export function useWorkoutStats(
  workoutId: number | null,
  startedAt: string | null
): WorkoutStats {
  const [stats, setStats] = useState<WorkoutStats>(EMPTY_STATS);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (workoutId == null || startedAt == null) {
      setStats(EMPTY_STATS);
      return;
    }

    const compute = () => {
      try {
        const allTrackpoints = getTrackpoints(workoutId);
        const trackpoints = filterReliableTrackpoints(allTrackpoints);
        const distance = trackpointDistance(trackpoints);

        const now = Date.now();
        const started = new Date(startedAt).getTime();
        const elapsedSeconds = Math.max(0, (now - started) / 1000);

        const pace100m = paceOverWindow(trackpoints, 100);
        const pace1000m = paceOverWindow(trackpoints, 1000);

        const bpm5s = getRecentAvgBpm(workoutId, 5);
        const bpm60s = getRecentAvgBpm(workoutId, 60);

        const pulses = getPulses(workoutId);
        const splits = computeKmSplits(trackpoints, pulses);

        setStats({
          distance,
          elapsedSeconds,
          pace100m,
          pace1000m,
          bpm5s,
          bpm60s,
          trackpoints,
          splits,
        });
      } catch (err) {
        console.error('[Stats] Failed to compute:', err);
      }
    };

    // Compute immediately, then poll every second
    compute();
    intervalRef.current = setInterval(compute, 1000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [workoutId, startedAt]);

  return stats;
}
