import { useState, useCallback, useRef, useEffect } from 'react';
import {
  startScan,
  connectToDevice,
  disconnect,
  getConnectionState,
  getLastBpm,
  setActiveWorkoutId,
  reconnectToLastDevice,
  getLastDeviceInfo,
  addListener,
  type HrConnectionState,
  type HrDevice,
} from '@/src/services/heartrate';

/**
 * Hook for BLE heart rate monitor interaction.
 * Uses a listener to stay in sync with the module-level BLE state,
 * so multiple hook instances (home screen + workout screen) all get updates.
 */
export function useHeartRate() {
  const [connectionState, setConnectionState] = useState<HrConnectionState>(
    getConnectionState()
  );
  const [currentBpm, setCurrentBpm] = useState<number | null>(getLastBpm());
  const [discoveredDevices, setDiscoveredDevices] = useState<HrDevice[]>([]);
  const stopScanRef = useRef<(() => void) | null>(null);

  // Register as a listener on mount so we get every state change,
  // regardless of which screen initiated the scan/connect.
  useEffect(() => {
    const unsubscribe = addListener({
      onBpmUpdate: (bpm) => setCurrentBpm(bpm),
      onConnectionStateChange: (state) => setConnectionState(state),
      onDeviceFound: (device) => {
        setDiscoveredDevices((prev) => {
          if (prev.some((d) => d.id === device.id)) return prev;
          return [...prev, device];
        });
      },
    });

    // Sync with current module state (might have changed between render and effect)
    setConnectionState(getConnectionState());
    setCurrentBpm(getLastBpm());

    return unsubscribe;
  }, []);

  const scan = useCallback(() => {
    setDiscoveredDevices([]);
    stopScanRef.current = startScan();
  }, []);

  const stopScanning = useCallback(() => {
    stopScanRef.current?.();
    stopScanRef.current = null;
  }, []);

  const connect = useCallback(async (deviceId: string) => {
    stopScanning();
    await connectToDevice(deviceId);
  }, [stopScanning]);

  const disconnectHr = useCallback(async () => {
    stopScanning();
    await disconnect();
    setCurrentBpm(null);
  }, [stopScanning]);

  const reconnect = useCallback(async () => {
    return reconnectToLastDevice();
  }, []);

  // Clean up scan on unmount
  useEffect(() => {
    return () => {
      stopScanRef.current?.();
    };
  }, []);

  return {
    connectionState,
    currentBpm,
    discoveredDevices,
    lastDevice: getLastDeviceInfo(),
    scan,
    stopScanning,
    connect,
    disconnect: disconnectHr,
    reconnect,
    setActiveWorkoutId,
  };
}
