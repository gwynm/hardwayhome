import { View, Text, ScrollView, StyleSheet } from 'react-native';
import type { Workout } from '@/src/db/queries';
import { formatDate, formatDistance, formatPace, formatBpm } from '@/src/utils/format';

type Props = {
  workouts: Workout[];
};

export function WorkoutHistory({ workouts }: Props) {
  if (workouts.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>No workouts yet</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={[styles.headerCell, styles.dateCol]}>Date</Text>
        <Text style={[styles.headerCell, styles.distCol]}>Distance</Text>
        <Text style={[styles.headerCell, styles.paceCol]}>Av Pace</Text>
        <Text style={[styles.headerCell, styles.bpmCol]}>Av BPM</Text>
      </View>
      <ScrollView>
        {workouts.map((w) => (
          <View key={w.id} style={styles.row}>
            <Text style={[styles.cell, styles.dateCol]}>
              {formatDate(w.started_at)}
            </Text>
            <Text style={[styles.cell, styles.distCol]}>
              {formatDistance(w.distance)}
            </Text>
            <Text style={[styles.cell, styles.paceCol]}>
              {formatPace(w.avg_sec_per_km)}
            </Text>
            <Text style={[styles.cell, styles.bpmCol]}>
              {formatBpm(w.avg_bpm)}
            </Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  empty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 60,
  },
  emptyText: {
    color: '#8E8E93',
    fontSize: 17,
  },
  headerRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#38383A',
  },
  row: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#2C2C2E',
  },
  headerCell: {
    fontSize: 12,
    color: '#8E8E93',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  cell: {
    fontSize: 15,
    color: '#FFFFFF',
    fontVariant: ['tabular-nums'],
  },
  dateCol: {
    flex: 2,
  },
  distCol: {
    flex: 2,
    textAlign: 'right',
  },
  paceCol: {
    flex: 1.5,
    textAlign: 'right',
  },
  bpmCol: {
    flex: 1,
    textAlign: 'right',
  },
});
