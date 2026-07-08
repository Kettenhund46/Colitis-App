import { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import { Text, View } from 'react-native';
import type { ExpoSQLiteDatabase } from 'drizzle-orm/expo-sqlite';
import { useMigrations } from 'drizzle-orm/expo-sqlite/migrator';
import migrations from '../drizzle/migrations';
import { createEncryptedDb } from '../src/db/client';
import * as schema from '../src/db/schema';
import { tokens } from '../src/styles/tokens';

export default function RootLayout() {
  const [db, setDb] = useState<ExpoSQLiteDatabase<typeof schema> | null>(null);
  const [initError, setInitError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    createEncryptedDb()
      .then((createdDb) => {
        if (isMounted) {
          setDb(createdDb);
        }
      })
      .catch((error: unknown) => {
        if (isMounted) {
          setInitError(error instanceof Error ? error.message : 'Unbekannter Datenbankfehler');
        }
      });
    return () => {
      isMounted = false;
    };
  }, []);

  if (initError) {
    return (
      <View style={styles.centered}>
        <Text>Fehler beim Öffnen der Datenbank: {initError}</Text>
      </View>
    );
  }

  if (!db) {
    return (
      <View style={styles.centered}>
        <Text>Datenbank wird geladen …</Text>
      </View>
    );
  }

  return <MigratedLayout db={db} />;
}

function MigratedLayout({ db }: { db: ExpoSQLiteDatabase<typeof schema> }) {
  const { success, error } = useMigrations(db, migrations);

  if (error) {
    return (
      <View style={styles.centered}>
        <Text>Datenbank-Migration fehlgeschlagen: {error.message}</Text>
      </View>
    );
  }

  if (!success) {
    return (
      <View style={styles.centered}>
        <Text>Datenbank wird vorbereitet …</Text>
      </View>
    );
  }

  return <Stack screenOptions={{ headerShown: false }} />;
}

const styles = {
  centered: {
    flex: 1,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    padding: tokens.spacing.lg,
    backgroundColor: tokens.colors.background,
  },
};
