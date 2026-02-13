import { useMemo } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { TouchableOpacity } from 'react-native';
import { AppleMaps } from 'expo-maps';
import {
  getWorkoutById,
  getTrackpoints,
  getPulses,
  type Trackpoint,
} from '@/src/db/queries';
import { trackpointDistance } from '@/src/utils/pace';
import { computeKmSplits } from '@/src/utils/splits';
import { filterReliableTrackpoints } from '@/src/utils/trackpointFilter';
import {
  formatDistance,
  formatDuration,
  formatPace,
  formatBpm,
  formatDate,
} from '@/src/utils/format';

export default function WorkoutDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const workoutId = Number(id);

  const data = useMemo(() => {
    const workout = getWorkoutById(workoutId);
    if (!workout || !workout.finished_at) return null;

    const trackpoints = filterReliableTrackpoints(getTrackpoints(workoutId));
    const pulses = getPulses(workoutId);
    const distance = trackpointDistance(trackpoints);
    const startMs = new Date(workout.started_at).getTime();
    const endMs = new Date(workout.finished_at).getTime();
    const elapsedSeconds = Math.max(0, (endMs - startMs) / 1000);

    const splits = computeKmSplits(trackpoints, pulses);

    return {
      workout,
      trackpoints,
      distance,
      elapsedSeconds,
      splits,
    };
  }, [workoutId]);

  // Compute map camera from trackpoint bounding box (must be before early return to satisfy hooks rules)
  const mapCamera = useMemo(
    () => (data ? computeCamera(data.trackpoints) : null),
    [data],
  );

  if (!data) {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.emptyText}>Workout not found</Text>
      </SafeAreaView>
    );
  }

  const { workout, trackpoints, distance, elapsedSeconds, splits } = data;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={styles.backButton}>‹ Back</Text>
          </TouchableOpacity>
          <Text style={styles.headerDate}>{formatDate(workout.started_at)}</Text>
          <View style={styles.headerSpacer} />
        </View>

        {/* Summary stats */}
        <View style={styles.grid}>
          <View style={styles.gridRow}>
            <StatCell label="Distance" value={formatDistance(distance)} />
            <StatCell label="Time" value={formatDuration(elapsedSeconds)} />
          </View>
        </View>

        {/* Km splits */}
        {splits.length > 0 && (
          <View style={styles.splitsSection}>
            <Text style={styles.splitsTitle}>Km Splits</Text>
            <View style={styles.splitsHeader}>
              <Text style={[styles.splitsHeaderCell, styles.kmCol]}>Km</Text>
              <Text style={[styles.splitsHeaderCell, styles.timeCol]}>Time</Text>
              <Text style={[styles.splitsHeaderCell, styles.bpmCol]}>Av BPM</Text>
            </View>
            {splits.map((split) => (
              <View key={split.km} style={styles.splitsRow}>
                <Text style={[styles.splitsCell, styles.kmCol]}>{split.km}</Text>
                <Text style={[styles.splitsCell, styles.timeCol]}>
                  {formatPace(split.seconds)}
                </Text>
                <Text style={[styles.splitsCell, styles.bpmCol]}>
                  {formatBpm(split.avgBpm)}
                </Text>
              </View>
            ))}
          </View>
        )}
        {/* Route map */}
        {trackpoints.length >= 2 && mapCamera && (
          <View style={styles.mapSection}>
            <Text style={styles.splitsTitle}>Route</Text>
            <View style={styles.mapContainer}>
              <AppleMaps.View
                style={styles.map}
                cameraPosition={mapCamera}
                polylines={[
                  {
                    coordinates: trackpoints.map((tp) => ({
                      latitude: tp.lat,
                      longitude: tp.lng,
                    })),
                    color: '#0A84FF',
                    width: 3,
                  },
                ]}
                properties={{
                  isTrafficEnabled: false,
                  pointsOfInterest: { including: [] },
                }}
                uiSettings={{
                  compassEnabled: true,
                  scaleBarEnabled: true,
                }}
              />
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

/**
 * Compute a camera position that fits the bounding box of the trackpoints.
 * Returns center coordinates and a zoom level estimated from the span.
 */
function computeCamera(trackpoints: Trackpoint[]): {
  coordinates: { latitude: number; longitude: number };
  zoom: number;
} | null {
  if (trackpoints.length === 0) return null;

  let minLat = Infinity, maxLat = -Infinity;
  let minLng = Infinity, maxLng = -Infinity;

  for (const tp of trackpoints) {
    if (tp.lat < minLat) minLat = tp.lat;
    if (tp.lat > maxLat) maxLat = tp.lat;
    if (tp.lng < minLng) minLng = tp.lng;
    if (tp.lng > maxLng) maxLng = tp.lng;
  }

  const midLat = (minLat + maxLat) / 2;
  const midLng = (minLng + maxLng) / 2;

  // Estimate zoom from the larger span dimension (in degrees)
  // Add padding so the track doesn't touch the edges
  const latSpan = (maxLat - minLat) * 1.3;
  const lngSpan = (maxLng - minLng) * 1.3;
  const span = Math.max(latSpan, lngSpan, 0.002); // minimum span

  // Rough mapping: zoom ~14 for 0.02 degrees, ~12 for 0.08, ~10 for 0.3
  // Formula: zoom ≈ log2(360 / span) + small offset for padding
  const zoom = Math.max(8, Math.min(18, Math.log2(360 / span) + 1.5));

  return {
    coordinates: { latitude: midLat, longitude: midLng },
    zoom,
  };
}

function StatCell({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.cell}>
      {label ? <Text style={styles.cellLabel}>{label}</Text> : null}
      <Text style={styles.cellValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  scroll: {
    paddingBottom: 40,
  },
  emptyText: {
    color: '#8E8E93',
    fontSize: 17,
    textAlign: 'center',
    paddingTop: 100,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backButton: {
    color: '#0A84FF',
    fontSize: 18,
    fontWeight: '500',
  },
  headerDate: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '600',
    textAlign: 'center',
  },
  headerSpacer: {
    width: 50, // Balance the back button
  },

  // Stats grid (matches LiveStats)
  grid: {
    gap: 2,
    marginHorizontal: 16,
    marginTop: 8,
  },
  gridRow: {
    flexDirection: 'row',
    gap: 2,
  },
  cell: {
    flex: 1,
    backgroundColor: '#2C2C2E',
    paddingVertical: 20,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  cellLabel: {
    fontSize: 12,
    color: '#8E8E93',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  cellValue: {
    fontSize: 32,
    color: '#FFFFFF',
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },

  // Splits
  splitsSection: {
    marginTop: 24,
    marginHorizontal: 16,
  },
  splitsTitle: {
    fontSize: 15,
    color: '#FFFFFF',
    fontWeight: '600',
    marginBottom: 12,
  },
  splitsHeader: {
    flexDirection: 'row',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#38383A',
  },
  splitsHeaderCell: {
    fontSize: 12,
    color: '#8E8E93',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  splitsRow: {
    flexDirection: 'row',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#2C2C2E',
  },
  splitsCell: {
    fontSize: 15,
    color: '#FFFFFF',
    fontVariant: ['tabular-nums'],
  },
  kmCol: {
    width: 50,
  },
  timeCol: {
    flex: 1,
    textAlign: 'right',
  },
  bpmCol: {
    width: 80,
    textAlign: 'right',
  },

  // Map
  mapSection: {
    marginTop: 24,
    marginHorizontal: 16,
  },
  mapContainer: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  map: {
    height: 350,
    width: '100%',
  },
});
