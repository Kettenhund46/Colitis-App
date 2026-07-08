import { useCallback, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { Pressable, Text, View, StyleSheet } from 'react-native';
import { createEncryptedDb } from '../../../src/db/client';
import { listDiaryEntries } from '../../../src/features/diary/db/diaryRepository';
import { DiaryHistoryList } from '../../../src/features/diary/components/DiaryHistoryList';
import { tokens } from '../../../src/styles/tokens';
import type { DiaryEntryWithTriggers } from '../../../src/features/diary/types';

export default function TagebuchScreen() {
  const router = useRouter();
  const [entries, setEntries] = useState<DiaryEntryWithTriggers[]>([]);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let isActive = true;

      createEncryptedDb()
        .then((db) => listDiaryEntries(db))
        .then((loadedEntries) => {
          if (isActive) {
            setEntries(loadedEntries);
            setError(null);
          }
        })
        .catch((loadError: unknown) => {
          console.error('[Tagebuch] Laden der Einträge fehlgeschlagen:', loadError);
          if (isActive) {
            setError('Einträge konnten nicht geladen werden.');
          }
        });

      return () => {
        isActive = false;
      };
    }, [])
  );

  return (
    <View style={styles.container}>
      {error && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Muster-Auswertung ansehen"
        style={styles.analysisLink}
        onPress={() => router.push('/tagebuch/auswertung')}
      >
        <Text style={styles.analysisLinkText}>Muster-Auswertung ansehen →</Text>
      </Pressable>
      <DiaryHistoryList entries={entries} />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Neuen Eintrag anlegen"
        style={styles.addButton}
        onPress={() => router.push('/tagebuch/neu')}
      >
        <Text style={styles.addButtonText}>+</Text>
      </Pressable>
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
  analysisLink: {
    backgroundColor: tokens.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: tokens.colors.border,
    padding: tokens.spacing.md,
  },
  analysisLinkText: {
    color: tokens.colors.primary,
    fontSize: tokens.typography.fontSize.sm,
    fontWeight: tokens.typography.fontWeight.medium,
    textAlign: 'center',
  },
  addButton: {
    position: 'absolute',
    right: tokens.spacing.lg,
    bottom: tokens.spacing.lg,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: tokens.colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
  },
  addButtonText: {
    color: tokens.colors.surface,
    fontSize: tokens.typography.fontSize.xl,
    fontWeight: tokens.typography.fontWeight.bold,
  },
});
