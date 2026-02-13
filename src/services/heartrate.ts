import { BleManager, Device, Subscription } from 'react-native-ble-plx';
import { insertPulse } from '@/src/db/queries';
import { kvGet, kvSet } from '@/src/db/queries';

// Standard Bluetooth Heart Rate Service UUIDs
// Use full 128-bit format for maximum compatibility across devices.
const HR_SERVICE_UUID = '0000180D-0000-1000-8000-00805F9B34FB';
const HR_MEASUREMENT_CHAR_UUID = '00002A37-0000-1000-8000-00805F9B34FB';

// KV keys
const KV_LAST_DEVICE_ID = 'ble_last_device_id';
const KV_LAST_DEVICE_NAME = 'ble_last_device_name';

export type HrConnectionState = 'disconnected' | 'scanning' | 'connecting' | 'connected';

export type HrDevice = {
  id: string;
  name: string | null;
};

export type HrListener = {
  onBpmUpdate?: (bpm: number) => void;
  onConnectionStateChange?: (state: HrConnectionState) => void;
  onDeviceFound?: (device: HrDevice) => void;
};

// ─── Module-level state ──────────────────────────────────────────────

let _manager: BleManager | null = null;
let _connectedDevice: Device | null = null;
let _hrSubscription: Subscription | null = null;
let _monitorSubscription: Subscription | null = null;
let _activeWorkoutId: number | null = null;
let _reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let _connectionState: HrConnectionState = 'disconnected';
let _lastBpm: number | null = null;

// Multiple listeners — every useHeartRate() hook instance registers one.
const _listeners = new Set<HrListener>();

// ─── Listener management ─────────────────────────────────────────────

/**
 * Register a listener for BLE state changes. Returns an unsubscribe function.
 * Each useHeartRate() hook instance should call this on mount.
 */
export function addListener(listener: HrListener): () => void {
  _listeners.add(listener);
  return () => {
    _listeners.delete(listener);
  };
}

function notifyConnectionState(state: HrConnectionState): void {
  _connectionState = state;
  for (const l of _listeners) {
    l.onConnectionStateChange?.(state);
  }
}

function notifyBpm(bpm: number): void {
  _lastBpm = bpm;
  for (const l of _listeners) {
    l.onBpmUpdate?.(bpm);
  }
}

function notifyDeviceFound(device: HrDevice): void {
  for (const l of _listeners) {
    l.onDeviceFound?.(device);
  }
}

// ─── BLE Manager ─────────────────────────────────────────────────────

function getManager(): BleManager {
  if (!_manager) {
    _manager = new BleManager({
      restoreStateIdentifier: 'hardwayhome-ble',
      restoreStateFunction: (restoredState) => {
        if (restoredState?.connectedPeripherals?.length) {
          console.log('[BLE] State restored with connected peripherals');
        }
      },
    });
  }
  return _manager;
}

export function getConnectionState(): HrConnectionState {
  return _connectionState;
}

/**
 * Trigger the iOS Bluetooth permission dialog.
 * Creating the BleManager and reading its state is what prompts iOS
 * for permission. Resolves once the state is known (or after timeout).
 */
export async function requestBlePermission(): Promise<void> {
  const manager = getManager();
  return new Promise<void>((resolve) => {
    const subscription = manager.onStateChange((state) => {
      // Any state other than Unknown means the permission dialog has resolved
      if (state !== 'Unknown') {
        subscription.remove();
        resolve();
      }
    }, true); // true = emit current state immediately

    // Safety timeout — don't block startup forever
    setTimeout(() => {
      subscription.remove();
      resolve();
    }, 5000);
  });
}

export function getLastBpm(): number | null {
  return _lastBpm;
}

// ─── Scanning ────────────────────────────────────────────────────────

/**
 * Scan for BLE heart rate monitors.
 * All registered listeners will be notified of discovered devices.
 * Returns a stop function.
 */
export function startScan(): () => void {
  const manager = getManager();
  notifyConnectionState('scanning');

  const seenDevices = new Set<string>();

  manager.startDeviceScan(
    [HR_SERVICE_UUID],
    { allowDuplicates: false },
    (error, device) => {
      if (error) {
        console.error('[BLE] Scan error:', error.message);
        // Also try with short UUID — some Android implementations need it
        notifyConnectionState(_connectedDevice ? 'connected' : 'disconnected');
        return;
      }
      if (device && !seenDevices.has(device.id)) {
        seenDevices.add(device.id);
        notifyDeviceFound({
          id: device.id,
          name: device.name || device.localName,
        });
      }
    }
  );

  return () => {
    manager.stopDeviceScan();
    if (_connectionState === 'scanning') {
      notifyConnectionState(_connectedDevice ? 'connected' : 'disconnected');
    }
  };
}

// ─── Connecting ──────────────────────────────────────────────────────

/**
 * Connect to a specific HR device and subscribe to heart rate notifications.
 */
export async function connectToDevice(deviceId: string): Promise<void> {
  const manager = getManager();

  // Stop any ongoing scan
  manager.stopDeviceScan();
  notifyConnectionState('connecting');

  try {
    const device = await manager.connectToDevice(deviceId, {
      autoConnect: true,
    });
    await device.discoverAllServicesAndCharacteristics();

    _connectedDevice = device;
    notifyConnectionState('connected');

    // Persist device ID for reconnection
    kvSet(KV_LAST_DEVICE_ID, device.id);
    kvSet(KV_LAST_DEVICE_NAME, device.name || device.localName || 'HR Monitor');

    // Subscribe to heart rate measurements
    subscribeToHeartRate(device);

    // Monitor disconnection
    _monitorSubscription?.remove();
    _monitorSubscription = manager.onDeviceDisconnected(
      device.id,
      (error) => {
        console.warn('[BLE] Device disconnected:', error?.message);
        _connectedDevice = null;
        _hrSubscription?.remove();
        _hrSubscription = null;
        _lastBpm = null;
        notifyConnectionState('disconnected');

        // Auto-reconnect if we have an active workout
        if (_activeWorkoutId != null) {
          scheduleReconnect(deviceId);
        }
      }
    );
  } catch (error) {
    console.error('[BLE] Connection failed:', error);
    notifyConnectionState('disconnected');
    throw error;
  }
}

/**
 * Attempt to reconnect to the last known device.
 */
export async function reconnectToLastDevice(): Promise<boolean> {
  const lastDeviceId = kvGet(KV_LAST_DEVICE_ID);
  if (!lastDeviceId) return false;

  try {
    await connectToDevice(lastDeviceId);
    return true;
  } catch {
    console.warn('[BLE] Failed to reconnect to last device');
    return false;
  }
}

// ─── HR subscription ─────────────────────────────────────────────────

function subscribeToHeartRate(device: Device): void {
  _hrSubscription?.remove();

  console.log('[BLE] Subscribing to HR characteristic...');

  _hrSubscription = device.monitorCharacteristicForService(
    HR_SERVICE_UUID,
    HR_MEASUREMENT_CHAR_UUID,
    (error, characteristic) => {
      if (error) {
        console.error('[BLE] HR notification error:', error.message);
        return;
      }
      if (!characteristic?.value) return;

      const bpm = parseHeartRate(characteristic.value);
      if (bpm != null) {
        notifyBpm(bpm);

        // Write to database if workout is active
        if (_activeWorkoutId != null) {
          try {
            insertPulse(_activeWorkoutId, bpm);
          } catch (err) {
            console.error('[BLE] Failed to write pulse:', err);
          }
        }
      }
    }
  ) as unknown as Subscription;

  console.log('[BLE] HR subscription active');
}

/**
 * Parse a Heart Rate Measurement characteristic value (base64-encoded).
 * Per Bluetooth HRM spec: byte 0 = flags, byte 1+ = heart rate.
 */
function parseHeartRate(base64Value: string): number | null {
  try {
    const raw = atob(base64Value);
    const bytes = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) {
      bytes[i] = raw.charCodeAt(i);
    }

    if (bytes.length < 2) return null;

    const flags = bytes[0];
    const is16Bit = (flags & 0x01) !== 0;

    if (is16Bit && bytes.length >= 3) {
      return bytes[1] | (bytes[2] << 8);
    }
    return bytes[1];
  } catch {
    return null;
  }
}

// ─── Reconnection ────────────────────────────────────────────────────

function scheduleReconnect(deviceId: string): void {
  cancelReconnect();
  let attempts = 0;
  const maxAttempts = 30; // 30 * 10s = 5 minutes

  const tryReconnect = async () => {
    if (_connectionState === 'connected') return;
    if (attempts >= maxAttempts) {
      console.warn('[BLE] Gave up reconnecting after', maxAttempts, 'attempts');
      return;
    }

    attempts++;
    console.log('[BLE] Reconnection attempt', attempts);

    try {
      await connectToDevice(deviceId);
    } catch {
      _reconnectTimer = setTimeout(tryReconnect, 10000);
    }
  };

  _reconnectTimer = setTimeout(tryReconnect, 10000);
}

function cancelReconnect(): void {
  if (_reconnectTimer) {
    clearTimeout(_reconnectTimer);
    _reconnectTimer = null;
  }
}

// ─── Public API ──────────────────────────────────────────────────────

export function setActiveWorkoutId(workoutId: number | null): void {
  _activeWorkoutId = workoutId;
}

export function getLastDeviceInfo(): HrDevice | null {
  const id = kvGet(KV_LAST_DEVICE_ID);
  if (!id) return null;
  return {
    id,
    name: kvGet(KV_LAST_DEVICE_NAME),
  };
}

export async function disconnect(): Promise<void> {
  cancelReconnect();
  _hrSubscription?.remove();
  _hrSubscription = null;
  _monitorSubscription?.remove();
  _monitorSubscription = null;
  _lastBpm = null;

  if (_connectedDevice) {
    try {
      await _connectedDevice.cancelConnection();
    } catch {
      // Already disconnected
    }
    _connectedDevice = null;
  }

  notifyConnectionState('disconnected');
}

export function destroyManager(): void {
  disconnect();
  _manager?.destroy();
  _manager = null;
}
