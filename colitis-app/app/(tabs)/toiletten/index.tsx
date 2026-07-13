import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { Linking, Text, View, StyleSheet } from 'react-native';
import * as Location from 'expo-location';
import { ToiletMapView } from '../../../src/features/toilets/components/ToiletMapView';
import { ToiletInfoCard } from '../../../src/features/toilets/components/ToiletInfoCard';
import { LocationPermissionBanner } from '../../../src/features/toilets/components/LocationPermissionBanner';
import { fetchNearbyToilets } from '../../../src/features/toilets/overpassClient';
import { haversineDistanceMeters } from '../../../src/features/toilets/distance';
import { hasMovedSignificantly } from '../../../src/features/toilets/regionChange';
import { buildNavigationUrl } from '../../../src/features/toilets/navigationLink';
import { SEARCH_RADIUS_METERS, REGION_CHANGE_THRESHOLD_METERS } from '../../../src/features/toilets/constants';
import { tokens } from '../../../src/styles/tokens';
import type { Coordinates, Toilet } from '../../../src/features/toilets/types';

const DEFAULT_CENTER: Coordinates = { latitude: 51.1657, longitude: 10.4515 };

export default function ToilettenScreen() {
  const [mapCenter, setMapCenter] = useState<Coordinates>(DEFAULT_CENTER);
  const [userLocation, setUserLocation] = useState<Coordinates | null>(null);
  const [lastSearchedCenter, setLastSearchedCenter] = useState<Coordinates | null>(null);
  const [toilets, setToilets] = useState<Toilet[]>([]);
  const [selectedToiletId, setSelectedToiletId] = useState<string | null>(null);
  const [locationDenied, setLocationDenied] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let isActive = true;

      Location.requestForegroundPermissionsAsync()
        .then(async (permission) => {
          if (!isActive) {
            return;
          }
          if (permission.status !== 'granted') {
            setLocationDenied(true);
            return;
          }
          setLocationDenied(false);
          const position = await Location.getCurrentPositionAsync({});
          if (!isActive) {
            return;
          }
          const coords: Coordinates = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          };
          setUserLocation(coords);
          setMapCenter(coords);
          await searchAround(coords);
        })
        .catch((error: unknown) => {
          console.error('[Toiletten] Standort konnte nicht ermittelt werden:', error);
          if (isActive) {
            setLocationDenied(true);
          }
        });

      return () => {
        isActive = false;
      };
    }, [])
  );

  async function searchAround(center: Coordinates) {
    try {
      const results = await fetchNearbyToilets(center, SEARCH_RADIUS_METERS);
      setToilets(results);
      setLastSearchedCenter(center);
      setLoadError(null);
    } catch (error: unknown) {
      console.error('[Toiletten] Toiletten konnten nicht geladen werden:', error);
      setLoadError('Toiletten konnten nicht geladen werden.');
    }
  }

  function handleRegionChange(center: Coordinates) {
    setMapCenter(center);
    if (!lastSearchedCenter || hasMovedSignificantly(lastSearchedCenter, center, REGION_CHANGE_THRESHOLD_METERS)) {
      searchAround(center);
    }
  }

  function handleMarkerTap(toiletId: string) {
    setSelectedToiletId(toiletId);
  }

  function handleNavigate(toilet: Toilet) {
    Linking.openURL(buildNavigationUrl({ latitude: toilet.latitude, longitude: toilet.longitude }));
  }

  const selectedToilet = toilets.find((toilet) => toilet.id === selectedToiletId) ?? null;

  return (
    <View style={styles.container}>
      {locationDenied && <LocationPermissionBanner />}
      {loadError && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{loadError}</Text>
        </View>
      )}
      <ToiletMapView
        center={mapCenter}
        toilets={toilets}
        onRegionChange={handleRegionChange}
        onMarkerTap={handleMarkerTap}
      />
      {selectedToilet && (
        <ToiletInfoCard
          toilet={selectedToilet}
          distanceMeters={haversineDistanceMeters(userLocation ?? mapCenter, selectedToilet)}
          onNavigate={() => handleNavigate(selectedToilet)}
          onClose={() => setSelectedToiletId(null)}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: tokens.colors.background,
  },
  errorBanner: {
    backgroundColor: tokens.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: tokens.colors.danger,
    padding: tokens.spacing.sm,
  },
  errorText: {
    color: tokens.colors.danger,
    fontSize: tokens.typography.fontSize.sm,
    textAlign: 'center',
  },
});
