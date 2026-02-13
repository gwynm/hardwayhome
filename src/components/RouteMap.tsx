import { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { AppleMaps } from 'expo-maps';
import type { Trackpoint } from '@/src/db/queries';

type Props = {
  trackpoints: Trackpoint[];
};

export function RouteMap({ trackpoints }: Props) {
  const camera = useMemo(() => computeCamera(trackpoints), [trackpoints]);

  if (trackpoints.length < 2 || !camera) return null;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Route</Text>
      <View style={styles.mapContainer}>
        <AppleMaps.View
          style={styles.map}
          cameraPosition={camera}
          polylines={[
            {
              coordinates: trackpoints.map((tp) => ({
                latitude: tp.lat,
                longitude: tp.lng,
              })),
              color: '#0A84FF',
              width: 3,
            },
          ]}
          properties={{
            isTrafficEnabled: false,
            pointsOfInterest: { including: [] },
          }}
          uiSettings={{
            compassEnabled: true,
            scaleBarEnabled: true,
          }}
        />
      </View>
    </View>
  );
}

/**
 * Compute a camera position that fits the bounding box of the trackpoints.
 */
function computeCamera(trackpoints: Trackpoint[]): {
  coordinates: { latitude: number; longitude: number };
  zoom: number;
} | null {
  if (trackpoints.length === 0) return null;

  let minLat = Infinity, maxLat = -Infinity;
  let minLng = Infinity, maxLng = -Infinity;

  for (const tp of trackpoints) {
    if (tp.lat < minLat) minLat = tp.lat;
    if (tp.lat > maxLat) maxLat = tp.lat;
    if (tp.lng < minLng) minLng = tp.lng;
    if (tp.lng > maxLng) maxLng = tp.lng;
  }

  const midLat = (minLat + maxLat) / 2;
  const midLng = (minLng + maxLng) / 2;

  const latSpan = (maxLat - minLat) * 1.3;
  const lngSpan = (maxLng - minLng) * 1.3;
  const span = Math.max(latSpan, lngSpan, 0.002);

  const zoom = Math.max(8, Math.min(18, Math.log2(360 / span) + 1.5));

  return {
    coordinates: { latitude: midLat, longitude: midLng },
    zoom,
  };
}

const styles = StyleSheet.create({
  container: {
    marginTop: 24,
    marginHorizontal: 16,
  },
  title: {
    fontSize: 15,
    color: '#FFFFFF',
    fontWeight: '600',
    marginBottom: 12,
  },
  mapContainer: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  map: {
    height: 350,
    width: '100%',
  },
});
