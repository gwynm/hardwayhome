import type { Trackpoint } from '@/src/db/queries';
import { haversineMetres } from './distance';

/**
 * GPS accuracy threshold in metres.
 * Points with err >= this value (or null) are excluded from calculations.
 */
export const GPS_ERR_THRESHOLD = 20;

/**
 * Maximum plausible speed in m/s (~50 km/h).
 * If implied speed between consecutive accepted points exceeds this,
 * the newer point is treated as a GPS teleport and rejected.
 */
export const MAX_SPEED_MS = 14;

/**
 * Filter trackpoints to only those reliable enough for distance/pace calculations.
 *
 * Two-stage filter in a single pass:
 * 1. Accuracy: reject points where err is null or >= GPS_ERR_THRESHOLD
 * 2. Speed: reject points that imply impossible speed from the last accepted point
 *
 * The raw trackpoints in the database are never modified — this is a pure
 * read-time filter applied before any calculations.
 */
export function filterReliableTrackpoints(trackpoints: Trackpoint[]): Trackpoint[] {
  const result: Trackpoint[] = [];

  for (const tp of trackpoints) {
    // Stage 1: accuracy filter
    if (tp.err == null || tp.err >= GPS_ERR_THRESHOLD) continue;

    // Stage 2: speed filter (against last accepted point)
    if (result.length > 0) {
      const prev = result[result.length - 1];
      const dist = haversineMetres(prev.lat, prev.lng, tp.lat, tp.lng);
      const dt =
        (new Date(tp.created_at).getTime() -
          new Date(prev.created_at).getTime()) /
        1000;
      if (dt > 0 && dist / dt > MAX_SPEED_MS) continue;
    }

    result.push(tp);
  }

  return result;
}
