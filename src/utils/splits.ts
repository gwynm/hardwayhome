import type { Trackpoint, Pulse } from '@/src/db/queries';
import { haversineMetres } from './distance';

export type KmSplit = {
  km: number; // 1-indexed split number
  seconds: number; // elapsed time for this split
  avgBpm: number | null; // average BPM during this split, null if no data
};

/**
 * Compute per-kilometre splits from trackpoints and pulse data.
 *
 * Walks through trackpoints accumulating distance. Each time the accumulated
 * distance crosses a 1 km boundary, a split is recorded with the elapsed time
 * and the average BPM of pulses that fall within that time window.
 *
 * Only completed kilometres are included — the final partial km is omitted.
 */
export function computeKmSplits(
  trackpoints: Trackpoint[],
  pulses: Pulse[],
): KmSplit[] {
  if (trackpoints.length < 2) return [];

  const splits: KmSplit[] = [];
  let cumulativeDistance = 0;
  let splitStartTime = new Date(trackpoints[0].created_at).getTime();
  let nextKmBoundary = 1000; // metres
  let pulseIdx = 0; // cursor into sorted pulses array

  for (let i = 1; i < trackpoints.length; i++) {
    const segDist = haversineMetres(
      trackpoints[i - 1].lat,
      trackpoints[i - 1].lng,
      trackpoints[i].lat,
      trackpoints[i].lng,
    );
    cumulativeDistance += segDist;

    if (cumulativeDistance >= nextKmBoundary) {
      const splitEndTime = new Date(trackpoints[i].created_at).getTime();
      const seconds = (splitEndTime - splitStartTime) / 1000;

      // Average BPM for pulses in [splitStartTime, splitEndTime]
      const avgBpm = averageBpmInWindow(pulses, pulseIdx, splitStartTime, splitEndTime);
      // Advance pulse cursor past this window
      pulseIdx = advancePulseIdx(pulses, pulseIdx, splitEndTime);

      splits.push({
        km: splits.length + 1,
        seconds,
        avgBpm,
      });

      splitStartTime = splitEndTime;
      nextKmBoundary += 1000;
    }
  }

  return splits;
}

/** Average BPM of pulses whose created_at falls within [startMs, endMs]. */
function averageBpmInWindow(
  pulses: Pulse[],
  startIdx: number,
  startMs: number,
  endMs: number,
): number | null {
  let sum = 0;
  let count = 0;

  for (let i = startIdx; i < pulses.length; i++) {
    const t = new Date(pulses[i].created_at).getTime();
    if (t > endMs) break;
    if (t >= startMs) {
      sum += pulses[i].bpm;
      count++;
    }
  }

  return count > 0 ? sum / count : null;
}

/** Advance pulse index past all pulses up to endMs. */
function advancePulseIdx(
  pulses: Pulse[],
  currentIdx: number,
  endMs: number,
): number {
  let idx = currentIdx;
  while (idx < pulses.length && new Date(pulses[idx].created_at).getTime() <= endMs) {
    idx++;
  }
  return idx;
}
