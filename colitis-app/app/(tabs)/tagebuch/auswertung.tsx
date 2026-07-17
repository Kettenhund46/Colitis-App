import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { Text, View, StyleSheet } from 'react-native';
import { createEncryptedDb } from '../../../src/db/client';
import { listDiaryEntries } from '../../../src/features/diary/db/diaryRepository';
import { computeTriggerPatterns } from '../../../src/features/diary/analysis';
import { TriggerAnalysisView } from '../../../src/features/diary/components/TriggerAnalysisView';
import { useTheme } from '../../../src/theme/ThemeContext';
import { tokens } from '../../../src/styles/tokens';
import type { TriggerPatternStat } from '../../../src/features/diary/analysis';
import type { ThemeColors } from '../../../src/theme/types';

export default function AuswertungScreen() {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const [patterns, setPatterns] = useState<TriggerPatternStat[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      let isActive = true;
      setIsLoading(true);

      createEncryptedDb()
        .then((db) => listDiaryEntries(db))
        .then((entries) => {
          if (isActive) {
            setPatterns(computeTriggerPatterns(entries));
            setError(null);
            setIsLoading(false);
          }
        })
        .catch((loadError: unknown) => {
          console.error('[Auswertung] Laden der Auswertung fehlgeschlagen:', loadError);
          if (isActive) {
            setError('Auswertung konnte nicht geladen werden.');
            setIsLoading(false);
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
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Auswertung wird geladen …</Text>
        </View>
      ) : (
        <TriggerAnalysisView patterns={patterns} />
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
    loadingContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: tokens.spacing.lg,
    },
    loadingText: {
      color: colors.textSecondary,
      fontSize: tokens.typography.fontSize.md,
    },
  });
}
