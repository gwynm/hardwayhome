import { View, Text, StyleSheet } from 'react-native';
import type { KmSplit } from '@/src/utils/splits';
import { formatPace, formatBpm } from '@/src/utils/format';

type Props = {
  splits: KmSplit[];
};

export function KmSplitsTable({ splits }: Props) {
  if (splits.length === 0) return null;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Km Splits</Text>
      <View style={styles.headerRow}>
        <Text style={[styles.headerCell, styles.kmCol]}>Km</Text>
        <Text style={[styles.headerCell, styles.timeCol]}>Time</Text>
        <Text style={[styles.headerCell, styles.bpmCol]}>Av BPM</Text>
      </View>
      {splits.map((split) => (
        <View key={split.km} style={styles.row}>
          <Text style={[styles.cell, styles.kmCol]}>{split.km}</Text>
          <Text style={[styles.cell, styles.timeCol]}>
            {formatPace(split.seconds)}
          </Text>
          <Text style={[styles.cell, styles.bpmCol]}>
            {formatBpm(split.avgBpm)}
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 24,
    marginHorizontal: 16,
  },
  title: {
    fontSize: 15,
    color: '#FFFFFF',
    fontWeight: '600',
    marginBottom: 12,
  },
  headerRow: {
    flexDirection: 'row',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#38383A',
  },
  headerCell: {
    fontSize: 12,
    color: '#8E8E93',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  row: {
    flexDirection: 'row',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#2C2C2E',
  },
  cell: {
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
