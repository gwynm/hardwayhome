import { TouchableOpacity, Text, StyleSheet } from 'react-native';
import type { HrConnectionState } from '@/src/services/heartrate';

type Props = {
  connectionState: HrConnectionState;
  currentBpm: number | null;
  onPress: () => void;
};

export function HrStatusIndicator({ connectionState, currentBpm, onPress }: Props) {
  const isConnected = connectionState === 'connected';
  const isConnecting = connectionState === 'connecting' || connectionState === 'scanning';

  let label: string;
  let backgroundColor: string;

  if (isConnected && currentBpm != null) {
    // Connected and receiving data — show live BPM
    label = `♥ ${currentBpm}`;
    backgroundColor = '#22C55E';
  } else if (isConnected) {
    // Connected but no BPM data yet — amber, waiting for first reading
    label = '♥ --';
    backgroundColor = '#EAB308';
  } else if (isConnecting) {
    // Scanning or mid-connection
    label = '♥ ...';
    backgroundColor = '#EAB308';
  } else {
    // Disconnected
    label = '♥ ✕';
    backgroundColor = '#EF4444';
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
  },
  label: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
});
