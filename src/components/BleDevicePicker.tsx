import { useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import type { HrDevice, HrConnectionState } from '@/src/services/heartrate';

type Props = {
  visible: boolean;
  onClose: () => void;
  connectionState: HrConnectionState;
  devices: HrDevice[];
  onScan: () => void;
  onStopScan: () => void;
  onConnect: (deviceId: string) => void;
  onDisconnect: () => void;
  lastDevice: HrDevice | null;
};

export function BleDevicePicker({
  visible,
  onClose,
  connectionState,
  devices,
  onScan,
  onStopScan,
  onConnect,
  onDisconnect,
  lastDevice,
}: Props) {
  const isScanning = connectionState === 'scanning';
  const isConnected = connectionState === 'connected';
  const isConnecting = connectionState === 'connecting';

  // Auto-scan when opened
  useEffect(() => {
    if (visible && connectionState === 'disconnected') {
      onScan();
    }
    return () => {
      if (visible) onStopScan();
    };
  }, [visible]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Heart Rate Monitor</Text>
          <TouchableOpacity onPress={onClose}>
            <Text style={styles.closeButton}>Done</Text>
          </TouchableOpacity>
        </View>

        {isConnected && (
          <View style={styles.connectedSection}>
            <Text style={styles.connectedText}>
              Connected to {lastDevice?.name || 'HR Monitor'}
            </Text>
            <TouchableOpacity
              style={styles.disconnectButton}
              onPress={onDisconnect}
            >
              <Text style={styles.disconnectText}>Disconnect</Text>
            </TouchableOpacity>
          </View>
        )}

        {isConnecting && (
          <View style={styles.connectingSection}>
            <ActivityIndicator size="small" color="#FFFFFF" />
            <Text style={styles.connectingText}>Connecting...</Text>
          </View>
        )}

        {!isConnected && !isConnecting && (
          <>
            <View style={styles.scanHeader}>
              <Text style={styles.scanLabel}>Available Devices</Text>
              {isScanning ? (
                <ActivityIndicator size="small" color="#0A84FF" />
              ) : (
                <TouchableOpacity onPress={onScan}>
                  <Text style={styles.scanButton}>Scan</Text>
                </TouchableOpacity>
              )}
            </View>

            {devices.length === 0 && isScanning && (
              <Text style={styles.emptyText}>Scanning for heart rate monitors...</Text>
            )}
            {devices.length === 0 && !isScanning && (
              <Text style={styles.emptyText}>
                No heart rate monitors found. Make sure your device is on and in range.
              </Text>
            )}

            <FlatList
              data={devices}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.deviceRow}
                  onPress={() => onConnect(item.id)}
                >
                  <Text style={styles.deviceName}>
                    {item.name || 'Unknown Device'}
                  </Text>
                  <Text style={styles.deviceId}>{item.id.slice(0, 8)}...</Text>
                </TouchableOpacity>
              )}
            />
          </>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1C1C1E',
    paddingTop: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 20,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#38383A',
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  closeButton: {
    fontSize: 17,
    color: '#0A84FF',
    fontWeight: '600',
  },
  connectedSection: {
    padding: 20,
    alignItems: 'center',
    gap: 12,
  },
  connectedText: {
    fontSize: 17,
    color: '#22C55E',
    fontWeight: '600',
  },
  disconnectButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: '#2C2C2E',
    borderRadius: 10,
  },
  disconnectText: {
    color: '#EF4444',
    fontSize: 15,
    fontWeight: '600',
  },
  connectingSection: {
    padding: 40,
    alignItems: 'center',
    gap: 12,
  },
  connectingText: {
    fontSize: 15,
    color: '#8E8E93',
  },
  scanHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  scanLabel: {
    fontSize: 13,
    color: '#8E8E93',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  scanButton: {
    fontSize: 15,
    color: '#0A84FF',
    fontWeight: '600',
  },
  emptyText: {
    color: '#8E8E93',
    fontSize: 15,
    textAlign: 'center',
    padding: 40,
  },
  deviceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#38383A',
  },
  deviceName: {
    fontSize: 17,
    color: '#FFFFFF',
  },
  deviceId: {
    fontSize: 13,
    color: '#8E8E93',
  },
});
