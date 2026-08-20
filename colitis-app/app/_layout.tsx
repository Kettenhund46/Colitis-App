import { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { useFonts } from 'expo-font';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import Ionicons from '@expo/vector-icons/Ionicons';
import type { ExpoSQLiteDatabase } from 'drizzle-orm/expo-sqlite';
import { useMigrations } from 'drizzle-orm/expo-sqlite/migrator';
import migrations from '../drizzle/migrations';
import { createEncryptedDb } from '../src/db/client';
import { rescheduleDiaryReminder } from '../src/features/diary/scheduleDiaryReminder';
import { resetAppData } from '../src/lib/appReset';
import { LockScreen } from '../src/features/appLock/components/LockScreen';
import { useAppLockGate } from '../src/features/appLock/useAppLockGate';
import { ThemeProvider, useTheme } from '../src/theme/ThemeContext';
import { SwipeNavigationProvider } from '../src/navigation/SwipeNavigationContext';
import { DailyJokeModal } from '../src/features/dailyJoke/components/DailyJokeModal';
import * as schema from '../src/db/schema';
import { tokens } from '../src/styles/tokens';
import type { ThemeColors } from '../src/theme/types';

export default function RootLayout() {
  return (
    <ThemeProvider>
      <SwipeNavigationProvider>
        <RootLayoutInner />
      </SwipeNavigationProvider>
    </ThemeProvider>
  );
}

function RootLayoutInner() {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const [fontsLoaded, fontError] = useFonts({ ...MaterialCommunityIcons.font, ...Ionicons.font });
  const [db, setDb] = useState<ExpoSQLiteDatabase<typeof schema> | null>(null);
  const [initError, setInitError] = useState<string | null>(null);
  const [dbGeneration, setDbGeneration] = useState(0);

  useEffect(() => {
    let isMounted = true;
    createEncryptedDb()
      .then((createdDb) => {
        if (isMounted) {
          setDb(createdDb);
          setInitError(null);
        }
      })
      .catch((error: unknown) => {
        console.error('[DB] Initialisierung fehlgeschlagen:', error);
        if (isMounted) {
          setInitError(error instanceof Error ? error.message : 'Unbekannter Datenbankfehler');
        }
      });
    return () => {
      isMounted = false;
    };
  }, [dbGeneration]);

  useEffect(() => {
    rescheduleDiaryReminder().catch((error: unknown) => {
      console.error('[Tagebuch] Erinnerung konnte beim Start nicht geplant werden:', error);
    });
  }, []);

  async function handleReset() {
    await resetAppData();
    setDb(null);
    setDbGeneration((generation) => generation + 1);
  }

  if (fontError) {
    return (
      <View style={styles.centered}>
        <Text style={styles.text}>Fehler beim Laden der Symbole: {fontError.message}</Text>
      </View>
    );
  }

  if (!fontsLoaded) {
    return (
      <View style={styles.centered}>
        <Text style={styles.text}>Wird vorbereitet …</Text>
      </View>
    );
  }

  if (initError) {
    return (
      <View style={styles.centered}>
        <Text style={styles.text}>Fehler beim Öffnen der Datenbank: {initError}</Text>
      </View>
    );
  }

  if (!db) {
    return (
      <View style={styles.centered}>
        <Text style={styles.text}>Datenbank wird geladen …</Text>
      </View>
    );
  }

  return <MigratedLayout db={db} onReset={handleReset} />;
}

function MigratedLayout({
  db,
  onReset,
}: {
  db: ExpoSQLiteDatabase<typeof schema>;
  onReset: () => Promise<void>;
}) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const { success, error } = useMigrations(db, migrations);
  const { isResolved, isLockRequired, unlock } = useAppLockGate();

  if (error) {
    console.error('[DB] Migration fehlgeschlagen:', error);
    return (
      <View style={styles.centered}>
        <Text style={styles.text}>Datenbank-Migration fehlgeschlagen: {error.message}</Text>
      </View>
    );
  }

  if (!success || !isResolved) {
    return (
      <View style={styles.centered}>
        <Text style={styles.text}>Datenbank wird vorbereitet …</Text>
      </View>
    );
  }

  if (isLockRequired) {
    return <LockScreen onUnlock={unlock} onReset={onReset} />;
  }

  return (
    <>
      <DailyJokeModal />
      <Stack screenOptions={{ headerShown: false }} />
    </>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    centered: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: tokens.spacing.lg,
      backgroundColor: colors.background,
    },
    text: {
      color: colors.textPrimary,
      fontSize: tokens.typography.fontSize.md,
    },
  });
}
