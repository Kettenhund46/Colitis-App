import { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import type { ExpoSQLiteDatabase } from 'drizzle-orm/expo-sqlite';
import { useMigrations } from 'drizzle-orm/expo-sqlite/migrator';
import migrations from '../drizzle/migrations';
import { createEncryptedDb } from '../src/db/client';
import { resetAppData } from '../src/lib/appReset';
import { LockScreen } from '../src/features/appLock/components/LockScreen';
import { useAppLockGate } from '../src/features/appLock/useAppLockGate';
import * as schema from '../src/db/schema';
import { tokens } from '../src/styles/tokens';

export default function RootLayout() {
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

  async function handleReset() {
    await resetAppData();
    setDb(null);
    setDbGeneration((generation) => generation + 1);
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

  return <Stack screenOptions={{ headerShown: false }} />;
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: tokens.spacing.lg,
    backgroundColor: tokens.colors.background,
  },
  text: {
    color: tokens.colors.textPrimary,
    fontSize: tokens.typography.fontSize.md,
  },
});
