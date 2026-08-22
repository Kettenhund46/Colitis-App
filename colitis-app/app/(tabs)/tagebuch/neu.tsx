import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'expo-router';
import { Text, View, StyleSheet } from 'react-native';
import { createEncryptedDb } from '../../../src/db/client';
import { createDiaryEntry } from '../../../src/features/diary/db/diaryRepository';
import { DiaryEntryForm } from '../../../src/features/diary/components/DiaryEntryForm';
import { saveFeedback } from '../../../src/lib/haptics';
import { useTheme } from '../../../src/theme/ThemeContext';
import { tokens } from '../../../src/styles/tokens';
import type { NewDiaryEntryInput } from '../../../src/features/diary/types';
import type { ThemeColors } from '../../../src/theme/types';

export default function NeuerEintragScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const [saveError, setSaveError] = useState<string | null>(null);
  const isMountedRef = useRef(true);

  useEffect(
    () => () => {
      isMountedRef.current = false;
    },
    []
  );

  async function handleSubmit(input: NewDiaryEntryInput) {
    try {
      const db = await createEncryptedDb();
      await createDiaryEntry(db, input);
      if (!isMountedRef.current) {
        return;
      }
      setSaveError(null);
      saveFeedback();
      router.back();
    } catch (error: unknown) {
      console.error('[Tagebuch] Speichern des Eintrags fehlgeschlagen:', error);
      if (isMountedRef.current) {
        setSaveError('Eintrag konnte nicht gespeichert werden.');
      }
    }
  }

  return (
    <View style={styles.container}>
      {saveError && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{saveError}</Text>
        </View>
      )}
      <DiaryEntryForm onSubmit={handleSubmit} />
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
  });
}
