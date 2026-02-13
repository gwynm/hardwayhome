import { useMemo } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import {
  getWorkoutById,
  getTrackpoints,
  getPulses,
} from '@/src/db/queries';
import { trackpointDistance } from '@/src/utils/pace';
import { computeKmSplits } from '@/src/utils/splits';
import { filterReliableTrackpoints } from '@/src/utils/trackpointFilter';
import { formatDistance, formatDuration, formatDate } from '@/src/utils/format';
import { KmSplitsTable } from '@/src/components/KmSplitsTable';
import { RouteMap } from '@/src/components/RouteMap';

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

    return { workout, trackpoints, distance, elapsedSeconds, splits };
  }, [workoutId]);

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
        <KmSplitsTable splits={splits} />

        {/* Route map */}
        <RouteMap trackpoints={trackpoints} />
      </ScrollView>
    </SafeAreaView>
  );
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
    width: 50,
  },

  // Stats grid
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
});
