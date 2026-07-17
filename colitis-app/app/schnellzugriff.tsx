import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { Linking, Pressable, Text, View, StyleSheet } from 'react-native';
import * as Location from 'expo-location';
import { createEncryptedDb } from '../src/db/client';
import { listSavedPlaces } from '../src/features/toilets/db/savedPlacesRepository';
import { listCachedToilets } from '../src/features/toilets/db/cachedToiletsRepository';
import { findNearestCandidate } from '../src/features/toilets/nearestCandidate';
import { buildNavigationUrl } from '../src/features/toilets/navigationLink';
import { tokens } from '../src/styles/tokens';
import { useTheme } from '../src/theme/ThemeContext';
import type { ThemeColors } from '../src/theme/types';
import type { Coordinates } from '../src/features/toilets/types';

type Status = 'loading' | 'no-location' | 'no-candidates' | 'error' | 'done';

export default function SchnellzugriffScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const [status, setStatus] = useState<Status>('loading');

  useEffect(() => {
    let isActive = true;

    async function run() {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== 'granted') {
        if (isActive) {
          setStatus('no-location');
        }
        return;
      }

      let origin: Coordinates;
      try {
        const position = await Location.getCurrentPositionAsync({});
        origin = { latitude: position.coords.latitude, longitude: position.coords.longitude };
      } catch (error: unknown) {
        console.error('[Schnellzugriff] Standort konnte nicht ermittelt werden:', error);
        if (isActive) {
          setStatus('no-location');
        }
        return;
      }

      const db = await createEncryptedDb();
      const [places, cachedToilets] = await Promise.all([listSavedPlaces(db), listCachedToilets(db)]);

      const nearest = findNearestCandidate(origin, cachedToilets, places);
      if (!nearest) {
        if (isActive) {
          setStatus('no-candidates');
        }
        return;
      }

      if (isActive) {
        setStatus('done');
      }
      await Linking.openURL(buildNavigationUrl(nearest));
    }

    run().catch((error: unknown) => {
      console.error('[Schnellzugriff] Fehler:', error);
      if (isActive) {
        setStatus('error');
      }
    });

    return () => {
      isActive = false;
    };
  }, []);

  if (status === 'loading' || status === 'done') {
    return (
      <View style={styles.container}>
        <Text style={styles.text}>Nächste Toilette wird gesucht …</Text>
      </View>
    );
  }

  const message =
    status === 'no-location'
      ? 'Standort nicht verfügbar. Bitte Standortberechtigung erteilen.'
      : status === 'error'
      ? 'Es ist ein Fehler aufgetreten. Bitte versuche es erneut.'
      : 'Es sind noch keine Toiletten oder sicheren Orte bekannt.';

  return (
    <View style={styles.container}>
      <Text style={styles.text}>{message}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Toiletten-Tab öffnen"
        style={styles.button}
        onPress={() => router.replace('/toiletten')}
      >
        <Text style={styles.buttonText}>Toiletten-Tab öffnen</Text>
      </Pressable>
    </View>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: tokens.spacing.lg,
      backgroundColor: colors.background,
    },
    text: {
      color: colors.textPrimary,
      fontSize: tokens.typography.fontSize.md,
      textAlign: 'center',
      marginBottom: tokens.spacing.md,
    },
    button: {
      backgroundColor: colors.accent,
      borderRadius: 8,
      paddingVertical: tokens.spacing.sm,
      paddingHorizontal: tokens.spacing.lg,
    },
    buttonText: {
      color: colors.surface,
      fontSize: tokens.typography.fontSize.md,
      fontWeight: tokens.typography.fontWeight.bold,
    },
  });
}
