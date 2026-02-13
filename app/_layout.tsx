import { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { router } from 'expo-router';
import { getDatabase } from '@/src/db/database';
import { getActiveWorkout } from '@/src/db/queries';
import { requestLocationPermissions } from '@/src/services/location';
import { requestBlePermission, reconnectToLastDevice } from '@/src/services/heartrate';
import { initBackupStatus } from '@/src/services/backup';

// Import location service to register the background task at module scope.
// This MUST happen at the top level of the root layout so it runs on
// every JS initialization, including headless background relaunches.
import '@/src/services/location';

export default function RootLayout() {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    async function init() {
      // Initialize database
      getDatabase();

      // Request all permissions upfront so the home screen has GPS status
      // immediately and hitting Start doesn't trigger permission dialogs.
      // These run in parallel — each shows its own iOS dialog sequentially
      // as the OS queues them.
      await Promise.all([
        requestLocationPermissions(),
        requestBlePermission(),
      ]);

      // Initialize backup status from stored config
      initBackupStatus();

      // Auto-reconnect to last known heart rate monitor (non-blocking).
      // This runs after BLE permission is granted and silently fails
      // if the device isn't nearby or was never paired.
      reconnectToLastDevice().catch(() => {});


      // Check for active workout and navigate accordingly
      const activeWorkout = getActiveWorkout();
      if (activeWorkout) {
        setTimeout(() => {
          router.replace('/workout');
        }, 0);
      }

      setIsReady(true);
    }

    init();
  }, []);

  if (!isReady) return null;

  return (
    <>
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: '#000000' },
          headerTintColor: '#FFFFFF',
          contentStyle: { backgroundColor: '#000000' },
          headerShown: false,
          animation: 'none',
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen
          name="workout"
          options={{
            gestureEnabled: false, // Prevent accidental swipe-back during workout
          }}
        />
        <Stack.Screen
          name="settings"
          options={{ gestureEnabled: true, fullScreenGestureEnabled: true }}
        />
        <Stack.Screen
          name="workout-detail"
          options={{ gestureEnabled: true, fullScreenGestureEnabled: true }}
        />
      </Stack>
      <StatusBar style="light" />
    </>
  );
}
