import type { Trackpoint } from '@/src/db/queries';
import { haversineMetres } from './distance';

/**
 * Compute pace (seconds per km) over a trailing distance window.
 *
 * Walks backwards through the trackpoint list to find the point approximately
 * `windowMetres` ago. Returns sec/km based on the time and distance between
 * that point and the most recent trackpoint.
 *
 * Returns null if there aren't enough trackpoints to cover the window.
 */
export function paceOverWindow(
  trackpoints: Trackpoint[],
  windowMetres: number
): number | null {
  if (trackpoints.length < 2) return null;

  const latest = trackpoints[trackpoints.length - 1];
  let accumulatedDistance = 0;

  // Walk backwards from the end
  for (let i = trackpoints.length - 2; i >= 0; i--) {
    const segmentDistance = haversineMetres(
      trackpoints[i].lat,
      trackpoints[i].lng,
      trackpoints[i + 1].lat,
      trackpoints[i + 1].lng
    );
    accumulatedDistance += segmentDistance;

    if (accumulatedDistance >= windowMetres) {
      // We've covered enough distance
      const timeMs =
        new Date(latest.created_at).getTime() -
        new Date(trackpoints[i].created_at).getTime();
      const timeSeconds = timeMs / 1000;

      if (accumulatedDistance <= 0 || timeSeconds <= 0) return null;

      // Convert to sec/km
      return (timeSeconds / accumulatedDistance) * 1000;
    }
  }

  // Not enough distance covered yet
  return null;
}

/**
 * Compute total distance in metres from a list of trackpoints.
 */
export function trackpointDistance(trackpoints: Trackpoint[]): number {
  let total = 0;
  for (let i = 1; i < trackpoints.length; i++) {
    total += haversineMetres(
      trackpoints[i - 1].lat,
      trackpoints[i - 1].lng,
      trackpoints[i].lat,
      trackpoints[i].lng
    );
  }
  return total;
}
