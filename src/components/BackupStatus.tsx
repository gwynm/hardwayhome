import { TouchableOpacity, Text, StyleSheet } from 'react-native';
import type { BackupStatus } from '@/src/services/backup';

type Props = {
  status: BackupStatus;
  onPress: () => void;
};

export function BackupStatusIndicator({ status, onPress }: Props) {
  let label: string;
  let backgroundColor: string;

  switch (status) {
    case 'not_configured':
      label = '☁ --';
      backgroundColor = '#8E8E93';
      break;
    case 'idle':
      label = '☁ ✓';
      backgroundColor = '#22C55E';
      break;
    case 'in_progress':
      label = '☁ ...';
      backgroundColor = '#EAB308';
      break;
    case 'success':
      label = '☁ ✓';
      backgroundColor = '#22C55E';
      break;
    case 'failed':
      label = '☁ ✕';
      backgroundColor = '#EF4444';
      break;
  }

  return (
    <TouchableOpacity
      style={[styles.pill, { backgroundColor }]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Text style={styles.label}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  pill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginLeft: 8,
  },
  label: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
});
