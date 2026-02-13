import { useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, router } from 'expo-router';
import { getWorkoutHistory, type Workout } from '@/src/db/queries';
import { useGpsStatus } from '@/src/hooks/useGpsStatus';
import { useHeartRate } from '@/src/hooks/useHeartRate';
import { useWorkoutRecording } from '@/src/hooks/useWorkoutRecording';
import { useBackupStatus } from '@/src/hooks/useBackupStatus';
import { GpsStatusIndicator } from '@/src/components/GpsStatus';
import { HrStatusIndicator } from '@/src/components/HrStatus';
import { BackupStatusIndicator } from '@/src/components/BackupStatus';
import { BleDevicePicker } from '@/src/components/BleDevicePicker';
import { WorkoutHistory } from '@/src/components/WorkoutHistory';

export default function HomeScreen() {
  const [showBlePicker, setShowBlePicker] = useState(false);
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const { start } = useWorkoutRecording();
  const hr = useHeartRate();
  const backupStatus = useBackupStatus();

  useFocusEffect(
    useCallback(() => {
      setWorkouts(getWorkoutHistory());
    }, [])
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Status bar */}
      <View style={styles.statusRow}>
        <GpsStatusIndicator />
        <HrStatusIndicator
          connectionState={hr.connectionState}
          currentBpm={hr.currentBpm}
          onPress={() => setShowBlePicker(true)}
        />
        <BackupStatusIndicator
          status={backupStatus}
          onPress={() => router.push('/settings')}
        />
        <View style={styles.spacer} />
        <TouchableOpacity onPress={() => router.push('/settings')} activeOpacity={0.7}>
          <Text style={styles.settingsButton}>⚙</Text>
        </TouchableOpacity>
      </View>

      {/* Start button */}
      <TouchableOpacity style={styles.startButton} onPress={start} activeOpacity={0.8}>
        <Text style={styles.startButtonText}>Start</Text>
      </TouchableOpacity>

      {/* Workout history */}
      <WorkoutHistory workouts={workouts} />

      {/* BLE picker modal */}
      <BleDevicePicker
        visible={showBlePicker}
        onClose={() => setShowBlePicker(false)}
        connectionState={hr.connectionState}
        devices={hr.discoveredDevices}
        onScan={hr.scan}
        onStopScan={hr.stopScanning}
        onConnect={hr.connect}
        onDisconnect={hr.disconnect}
        lastDevice={hr.lastDevice}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  spacer: {
    flex: 1,
  },
  settingsButton: {
    fontSize: 22,
    color: '#8E8E93',
  },
  startButton: {
    backgroundColor: '#22C55E',
    marginHorizontal: 16,
    marginVertical: 16,
    paddingVertical: 18,
    borderRadius: 14,
    alignItems: 'center',
  },
  startButtonText: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '700',
  },
});
