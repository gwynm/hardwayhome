import { View, Text, StyleSheet } from 'react-native';
import { useGpsStatus, type GpsStatus as GpsStatusType } from '@/src/hooks/useGpsStatus';

const STATUS_COLORS: Record<GpsStatusType, string> = {
  none: '#EF4444',   // red
  poor: '#EAB308',   // yellow
  good: '#22C55E',   // green
};

const STATUS_LABELS: Record<GpsStatusType, string> = {
  none: 'No GPS',
  poor: 'GPS',
  good: 'GPS',
};

export function GpsStatusIndicator() {
  const { status, accuracy } = useGpsStatus();
  const color = STATUS_COLORS[status];

  return (
    <View style={[styles.pill, { backgroundColor: color }]}>
      <Text style={styles.label}>
        {STATUS_LABELS[status]}
        {accuracy != null && ` ±${Math.round(accuracy)}m`}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginRight: 8,
  },
  label: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
});
