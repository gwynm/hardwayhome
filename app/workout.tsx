import { useState, useEffect } from 'react';
import { Alert, View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { useWorkoutRecording } from '@/src/hooks/useWorkoutRecording';
import { useWorkoutStats } from '@/src/hooks/useWorkoutStats';
import { useHeartRate } from '@/src/hooks/useHeartRate';
import { LiveStats } from '@/src/components/LiveStats';
import { GpsStatusIndicator } from '@/src/components/GpsStatus';
import { HrStatusIndicator } from '@/src/components/HrStatus';
import { BackupStatusIndicator } from '@/src/components/BackupStatus';
import { BleDevicePicker } from '@/src/components/BleDevicePicker';
import { KmSplitsTable } from '@/src/components/KmSplitsTable';
import { RouteMap } from '@/src/components/RouteMap';
import { useBackupStatus } from '@/src/hooks/useBackupStatus';

export default function WorkoutScreen() {
  const [showBlePicker, setShowBlePicker] = useState(false);
  const { activeWorkout, finish, discard } = useWorkoutRecording();
  const stats = useWorkoutStats(
    activeWorkout?.id ?? null,
    activeWorkout?.started_at ?? null
  );
  const hr = useHeartRate();
  const backupStatus = useBackupStatus();

  // Keep the screen awake during workouts
  useEffect(() => {
    activateKeepAwakeAsync();
    return () => {
      deactivateKeepAwake();
    };
  }, []);

  // Set BLE to record pulses for this workout
  useEffect(() => {
    if (activeWorkout) {
      hr.setActiveWorkoutId(activeWorkout.id);
    }
    return () => {
      hr.setActiveWorkoutId(null);
    };
  }, [activeWorkout?.id]);

  const confirmDiscard = () => {
    if (stats.distance > 500) {
      Alert.alert(
        'Are you sure?',
        `You have ${(stats.distance / 1000).toFixed(1)} km of data. This cannot be undone.`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Delete', style: 'destructive', onPress: () => discard() },
        ]
      );
    } else {
      discard();
    }
  };

  const handleStop = () => {
    Alert.alert(
      'Stop Workout',
      'What would you like to do?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Finish & Save',
          onPress: () => finish(),
        },
        {
          text: 'Finish & Delete',
          style: 'destructive',
          onPress: confirmDiscard,
        },
      ]
    );
  };

  if (!activeWorkout) {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.noWorkoutText}>No active workout</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Status indicators */}
        <View style={styles.statusRow}>
          <GpsStatusIndicator />
          <HrStatusIndicator
            connectionState={hr.connectionState}
            currentBpm={hr.currentBpm}
            onPress={() => setShowBlePicker(true)}
          />
          <BackupStatusIndicator
            status={backupStatus}
            onPress={() => {}}
          />
        </View>

        {/* Stop button — at top so it's always reachable */}
        <View style={styles.stopSection}>
          <TouchableOpacity
            style={styles.stopButton}
            onPress={handleStop}
            activeOpacity={0.8}
          >
            <Text style={styles.stopButtonText}>Stop</Text>
          </TouchableOpacity>
        </View>

        {/* Live stats grid */}
        <View style={styles.statsContainer}>
          <LiveStats stats={stats} />
        </View>

        {/* Km splits */}
        <KmSplitsTable splits={stats.splits} />

        {/* Route map */}
        <RouteMap trackpoints={stats.trackpoints} />
      </ScrollView>

      {/* BLE device picker modal */}
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
  scroll: {
    paddingBottom: 40,
  },
  statusRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  stopSection: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  stopButton: {
    backgroundColor: '#EF4444',
    paddingVertical: 18,
    borderRadius: 14,
    alignItems: 'center',
  },
  stopButtonText: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '700',
  },
  statsContainer: {
    paddingHorizontal: 16,
  },
  noWorkoutText: {
    color: '#8E8E93',
    fontSize: 17,
    textAlign: 'center',
    paddingTop: 100,
  },
});
