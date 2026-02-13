import { View, Text, StyleSheet } from 'react-native';
import type { WorkoutStats } from '@/src/hooks/useWorkoutStats';
import { formatDistance, formatDuration, formatPace, formatBpm } from '@/src/utils/format';

type Props = {
  stats: WorkoutStats;
};

export function LiveStats({ stats }: Props) {
  return (
    <View style={styles.grid}>
      <View style={styles.row}>
        <StatCell label="Distance" value={formatDistance(stats.distance)} />
        <StatCell label="Time" value={formatDuration(stats.elapsedSeconds)} />
      </View>
      <View style={styles.row}>
        <StatCell label="Pace (100m)" value={formatPace(stats.pace100m)} />
        <StatCell label="Pace (1km)" value={formatPace(stats.pace1000m)} />
      </View>
      <View style={styles.row}>
        <StatCell label="BPM (5s)" value={formatBpm(stats.bpm5s)} />
        <StatCell label="BPM (60s)" value={formatBpm(stats.bpm60s)} />
      </View>
    </View>
  );
}

function StatCell({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.cell}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    gap: 2,
  },
  row: {
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
  label: {
    fontSize: 12,
    color: '#8E8E93',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  value: {
    fontSize: 32,
    color: '#FFFFFF',
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
});
