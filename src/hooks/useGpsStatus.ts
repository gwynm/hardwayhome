import { useState, useEffect, useRef } from 'react';
import * as Location from 'expo-location';
import { watchLocation } from '@/src/services/location';
import { GPS_ERR_THRESHOLD } from '@/src/utils/trackpointFilter';

export type GpsStatus = 'none' | 'poor' | 'good';

/**
 * Returns the current GPS fix quality and accuracy in metres.
 * Thresholds match the trackpoint filter so the indicator reflects
 * whether incoming points are being used in calculations:
 * - 'good': accuracy < GPS_ERR_THRESHOLD (green — included)
 * - 'poor': accuracy >= GPS_ERR_THRESHOLD (yellow — excluded)
 * - 'none': no fix / null accuracy (red)
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

        if (acc == null) {
          setStatus('none');
        } else if (acc >= GPS_ERR_THRESHOLD) {
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
