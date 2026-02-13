import { useMemo } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { TouchableOpacity } from 'react-native';
import {
  getWorkoutById,
  getTrackpoints,
  getPulses,
} from '@/src/db/queries';
import { trackpointDistance } from '@/src/utils/pace';
import { paceOverWindow } from '@/src/utils/pace';
import { computeKmSplits } from '@/src/utils/splits';
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

    const trackpoints = getTrackpoints(workoutId);
    const pulses = getPulses(workoutId);
    const distance = trackpointDistance(trackpoints);
    const startMs = new Date(workout.started_at).getTime();
    const endMs = new Date(workout.finished_at).getTime();
    const elapsedSeconds = Math.max(0, (endMs - startMs) / 1000);

    const pace100m = paceOverWindow(trackpoints, 100);
    const pace1000m = paceOverWindow(trackpoints, 1000);

    // Overall average BPM
    const avgBpm = workout.avg_bpm;

    const splits = computeKmSplits(trackpoints, pulses);

    return {
      workout,
      distance,
      elapsedSeconds,
      pace100m,
      pace1000m,
      avgBpm,
      splits,
    };
  }, [workoutId]);

  if (!data) {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.emptyText}>Workout not found</Text>
      </SafeAreaView>
    );
  }

  const { workout, distance, elapsedSeconds, pace100m, pace1000m, avgBpm, splits } = data;

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

        {/* Summary stats grid */}
        <View style={styles.grid}>
          <View style={styles.gridRow}>
            <StatCell label="Distance" value={formatDistance(distance)} />
            <StatCell label="Time" value={formatDuration(elapsedSeconds)} />
          </View>
          <View style={styles.gridRow}>
            <StatCell label="Pace (100m)" value={formatPace(pace100m)} />
            <StatCell label="Pace (1km)" value={formatPace(pace1000m)} />
          </View>
          <View style={styles.gridRow}>
            <StatCell label="Avg BPM" value={formatBpm(avgBpm)} />
            <StatCell label="" value="" />
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
});
