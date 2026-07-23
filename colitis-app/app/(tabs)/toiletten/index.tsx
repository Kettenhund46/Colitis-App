import { useCallback, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { Alert, Linking, Text, View, StyleSheet } from 'react-native';
import * as Location from 'expo-location';
import {
  beginPendingPermissionRequest,
  endPendingPermissionRequest,
} from '../../../src/features/appLock/pendingPermissionGuard';
import { ToiletMapView } from '../../../src/features/toilets/components/ToiletMapView';
import { ToiletInfoCard } from '../../../src/features/toilets/components/ToiletInfoCard';
import { SavedPlaceInfoCard } from '../../../src/features/toilets/components/SavedPlaceInfoCard';
import { SavedPlaceForm } from '../../../src/features/toilets/components/SavedPlaceForm';
import { LocationPermissionBanner } from '../../../src/features/toilets/components/LocationPermissionBanner';
import { fetchNearbyToilets } from '../../../src/features/toilets/overpassClient';
import { haversineDistanceMeters } from '../../../src/features/toilets/distance';
import { hasMovedSignificantly } from '../../../src/features/toilets/regionChange';
import { buildNavigationUrl } from '../../../src/features/toilets/navigationLink';
import {
  SEARCH_RADIUS_METERS,
  REGION_CHANGE_THRESHOLD_METERS,
  LOCATION_TIMEOUT_MS,
} from '../../../src/features/toilets/constants';
import { withTimeout, TimeoutError } from '../../../src/lib/withTimeout';
import { createEncryptedDb } from '../../../src/db/client';
import {
  createSavedPlace,
  listSavedPlaces,
  updateSavedPlace,
  deleteSavedPlace,
} from '../../../src/features/toilets/db/savedPlacesRepository';
import { replaceCachedToilets, listCachedToilets } from '../../../src/features/toilets/db/cachedToiletsRepository';
import { useTheme } from '../../../src/theme/ThemeContext';
import { tokens } from '../../../src/styles/tokens';
import type { Coordinates, SavedPlace, SavedPlaceInput, Toilet } from '../../../src/features/toilets/types';
import type { SavedPlaceFormState } from '../../../src/features/toilets/savedPlaceFormLogic';
import type { ThemeColors } from '../../../src/theme/types';

const DEFAULT_CENTER: Coordinates = { latitude: 51.1657, longitude: 10.4515 };

type SelectedMarker = { id: string; kind: 'toilet' | 'place' };
type FormMode = { mode: 'create'; coordinates: Coordinates } | { mode: 'edit'; place: SavedPlace } | null;

export default function ToilettenScreen() {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const [mapCenter, setMapCenter] = useState<Coordinates>(DEFAULT_CENTER);
  const [userLocation, setUserLocation] = useState<Coordinates | null>(null);
  const [lastSearchedCenter, setLastSearchedCenter] = useState<Coordinates | null>(null);
  const [toilets, setToilets] = useState<Toilet[]>([]);
  const [savedPlaces, setSavedPlaces] = useState<SavedPlace[]>([]);
  const [selectedMarker, setSelectedMarker] = useState<SelectedMarker | null>(null);
  const [formState, setFormState] = useState<FormMode>(null);
  const [locationDenied, setLocationDenied] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [offlineHint, setOfflineHint] = useState<string | null>(null);
  const [placeError, setPlaceError] = useState<string | null>(null);
  const [isLocationResolved, setIsLocationResolved] = useState(false);
  const searchRequestIdRef = useRef(0);

  useFocusEffect(
    useCallback(() => {
      let isActive = true;

      createEncryptedDb()
        .then(async (db) => {
          const places = await listSavedPlaces(db);
          if (isActive) {
            setSavedPlaces(places);
          }
        })
        .catch((error: unknown) => {
          console.error('[Toiletten] Sichere Orte konnten nicht geladen werden:', error);
        });

      beginPendingPermissionRequest();
      Location.requestForegroundPermissionsAsync()
        .then(async (permission) => {
          endPendingPermissionRequest();
          if (!isActive) {
            return;
          }
          if (permission.status !== 'granted') {
            setLocationDenied(true);
            setIsLocationResolved(true);
            return;
          }
          setLocationDenied(false);
          try {
            const position = await withTimeout(
              Location.getCurrentPositionAsync({}),
              LOCATION_TIMEOUT_MS,
              'Standortabfrage abgebrochen (Zeitüberschreitung).'
            );
            if (!isActive) {
              return;
            }
            const coords: Coordinates = {
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
            };
            setUserLocation(coords);
            setMapCenter(coords);
            setLocationError(null);
            setIsLocationResolved(true);
            await searchAround(coords);
          } catch (error: unknown) {
            console.error('[Toiletten] Standort konnte nicht ermittelt werden:', error);
            if (isActive) {
              setLocationError(
                error instanceof TimeoutError ? error.message : 'Standort konnte nicht ermittelt werden.'
              );
              setIsLocationResolved(true);
            }
          }
        })
        .catch((error: unknown) => {
          endPendingPermissionRequest();
          console.error('[Toiletten] Standortberechtigung konnte nicht abgefragt werden:', error);
          if (isActive) {
            setLocationDenied(true);
            setIsLocationResolved(true);
          }
        });

      return () => {
        isActive = false;
      };
    }, [])
  );

  async function reloadSavedPlaces() {
    const db = await createEncryptedDb();
    setSavedPlaces(await listSavedPlaces(db));
  }

  async function searchAround(center: Coordinates) {
    const requestId = ++searchRequestIdRef.current;
    try {
      const results = await fetchNearbyToilets(center, SEARCH_RADIUS_METERS);
      if (requestId !== searchRequestIdRef.current) {
        return;
      }
      setToilets(results);
      setLastSearchedCenter(center);
      setLoadError(null);
      setOfflineHint(null);
      try {
        const db = await createEncryptedDb();
        await replaceCachedToilets(db, results);
      } catch (cacheError: unknown) {
        console.error('[Toiletten] Cache konnte nicht aktualisiert werden:', cacheError);
      }
    } catch (error: unknown) {
      if (requestId !== searchRequestIdRef.current) {
        return;
      }
      console.error('[Toiletten] Toiletten konnten nicht geladen werden:', error);
      await handleSearchFailure(requestId);
    }
  }

  async function handleSearchFailure(requestId: number) {
    try {
      const db = await createEncryptedDb();
      const cached = await listCachedToilets(db);
      if (requestId !== searchRequestIdRef.current) {
        return;
      }
      if (cached.length > 0) {
        setToilets(cached);
        setOfflineHint('Offline — zeigt zuletzt geladene Toiletten');
        setLoadError(null);
        return;
      }
    } catch (cacheError: unknown) {
      console.error('[Toiletten] Cache konnte nicht gelesen werden:', cacheError);
    }
    if (requestId !== searchRequestIdRef.current) {
      return;
    }
    setLoadError('Toiletten konnten nicht geladen werden.');
    setOfflineHint(null);
  }

  function handleRegionChange(center: Coordinates) {
    setMapCenter(center);
    if (!isLocationResolved) {
      return;
    }
    if (!lastSearchedCenter || hasMovedSignificantly(lastSearchedCenter, center, REGION_CHANGE_THRESHOLD_METERS)) {
      searchAround(center);
    }
  }

  function handleMarkerTap(id: string, kind: 'toilet' | 'place') {
    setSelectedMarker({ id, kind });
  }

  function handleLongPress(coordinates: Coordinates) {
    setSelectedMarker(null);
    setFormState({ mode: 'create', coordinates });
  }

  function handleEditPlace(place: SavedPlace) {
    setSelectedMarker(null);
    setFormState({ mode: 'edit', place });
  }

  async function handleSubmitForm(input: SavedPlaceInput) {
    try {
      const db = await createEncryptedDb();
      if (formState?.mode === 'edit') {
        await updateSavedPlace(db, formState.place.id, input);
      } else {
        await createSavedPlace(db, input);
      }
      setPlaceError(null);
      setFormState(null);
      await reloadSavedPlaces();
    } catch (error: unknown) {
      console.error('[Toiletten] Sicheren Ort speichern fehlgeschlagen:', error);
      setPlaceError('Sicherer Ort konnte nicht gespeichert werden.');
    }
  }

  function handleDeletePlace(place: SavedPlace) {
    Alert.alert('Sicheren Ort löschen?', `"${place.name}" wird endgültig gelöscht.`, [
      { text: 'Abbrechen', style: 'cancel' },
      {
        text: 'Löschen',
        style: 'destructive',
        onPress: async () => {
          try {
            const db = await createEncryptedDb();
            await deleteSavedPlace(db, place.id);
            setPlaceError(null);
            setSelectedMarker(null);
            await reloadSavedPlaces();
          } catch (error: unknown) {
            console.error('[Toiletten] Sicheren Ort löschen fehlgeschlagen:', error);
            setPlaceError('Sicherer Ort konnte nicht gelöscht werden.');
          }
        },
      },
    ]);
  }

  function handleNavigate(destination: Coordinates) {
    Linking.openURL(buildNavigationUrl(destination));
  }

  const selectedToilet =
    selectedMarker?.kind === 'toilet' ? toilets.find((toilet) => toilet.id === selectedMarker.id) ?? null : null;
  const selectedPlace =
    selectedMarker?.kind === 'place'
      ? savedPlaces.find((place) => String(place.id) === selectedMarker.id) ?? null
      : null;

  const formInitialState: SavedPlaceFormState | undefined =
    formState?.mode === 'edit'
      ? { name: formState.place.name, category: formState.place.category, note: formState.place.note ?? '' }
      : undefined;
  const formCoordinates: Coordinates | null =
    formState?.mode === 'create' ? formState.coordinates : formState?.mode === 'edit' ? formState.place : null;

  return (
    <View style={styles.container}>
      {locationDenied && <LocationPermissionBanner />}
      {locationError && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{locationError}</Text>
        </View>
      )}
      {loadError && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{loadError}</Text>
        </View>
      )}
      {offlineHint && (
        <View style={styles.offlineBanner}>
          <Text style={styles.offlineText}>{offlineHint}</Text>
        </View>
      )}
      {placeError && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{placeError}</Text>
        </View>
      )}
      <ToiletMapView
        center={mapCenter}
        toilets={toilets}
        savedPlaces={savedPlaces}
        onRegionChange={handleRegionChange}
        onMarkerTap={handleMarkerTap}
        onLongPress={handleLongPress}
      />
      {selectedToilet && (
        <ToiletInfoCard
          toilet={selectedToilet}
          distanceMeters={haversineDistanceMeters(userLocation ?? mapCenter, selectedToilet)}
          onNavigate={() => handleNavigate(selectedToilet)}
          onClose={() => setSelectedMarker(null)}
        />
      )}
      {selectedPlace && (
        <SavedPlaceInfoCard
          place={selectedPlace}
          onNavigate={() => handleNavigate(selectedPlace)}
          onEdit={() => handleEditPlace(selectedPlace)}
          onDelete={() => handleDeletePlace(selectedPlace)}
          onClose={() => setSelectedMarker(null)}
        />
      )}
      {formState && formCoordinates && (
        <SavedPlaceForm
          coordinates={formCoordinates}
          initialState={formInitialState}
          submitLabel={formState.mode === 'edit' ? 'Speichern' : 'Anlegen'}
          onSubmit={handleSubmitForm}
          onCancel={() => setFormState(null)}
        />
      )}
    </View>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    errorBanner: {
      backgroundColor: colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: colors.danger,
      padding: tokens.spacing.sm,
    },
    errorText: {
      color: colors.danger,
      fontSize: tokens.typography.fontSize.sm,
      textAlign: 'center',
    },
    offlineBanner: {
      backgroundColor: colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      padding: tokens.spacing.sm,
    },
    offlineText: {
      color: colors.textSecondary,
      fontSize: tokens.typography.fontSize.sm,
      textAlign: 'center',
    },
  });
}
