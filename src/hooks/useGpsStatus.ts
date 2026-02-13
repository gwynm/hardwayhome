import { useState, useEffect, useRef } from 'react';
import * as Location from 'expo-location';
import { watchLocation } from '@/src/services/location';

export type GpsStatus = 'none' | 'poor' | 'good';

/**
 * Returns the current GPS fix quality and accuracy in metres.
 * - 'none': no fix or accuracy > 50m
 * - 'poor': accuracy > 10m
 * - 'good': accuracy <= 10m
 */
export function useGpsStatus(): { status: GpsStatus; accuracy: number | null } {
  const [status, setStatus] = useState<GpsStatus>('none');
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const subscriptionRef = useRef<Location.LocationSubscription | null>(null);

  useEffect(() => {
    let mounted = true;

    (async () => {
      const { status: permStatus } = await Location.getForegroundPermissionsAsync();
      if (permStatus !== 'granted') {
        if (mounted) setStatus('none');
        return;
      }

      subscriptionRef.current = await watchLocation((location) => {
        if (!mounted) return;
        const acc = location.coords.accuracy ?? null;
        setAccuracy(acc);

        if (acc == null || acc > 50) {
          setStatus('none');
        } else if (acc > 10) {
          setStatus('poor');
        } else {
          setStatus('good');
        }
      });
    })();

    return () => {
      mounted = false;
      subscriptionRef.current?.remove();
    };
  }, []);

  return { status, accuracy };
}
