import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { Text, View, StyleSheet } from 'react-native';
import { createEncryptedDb } from '../../../../src/db/client';
import { listMeals } from '../../../../src/features/nutrition/db/mealsRepository';
import { listDiaryEntries } from '../../../../src/features/diary/db/diaryRepository';
import {
  buildBadDayMeals,
  NO_CORRELATION_TITLE,
  NO_CORRELATION_DESCRIPTION,
} from '../../../../src/features/nutrition/mealCorrelation';
import { BadDayMealsView } from '../../../../src/features/nutrition/components/BadDayMealsView';
import { EmptyState } from '../../../../src/components/ui/EmptyState';
import { SkeletonList } from '../../../../src/components/ui/SkeletonList';
import { useTheme } from '../../../../src/theme/ThemeContext';
import { tokens } from '../../../../src/styles/tokens';
import type { BadDayMeals } from '../../../../src/features/nutrition/mealCorrelation';
import type { ThemeColors } from '../../../../src/theme/types';

export default function ErnaehrungsAuswertungScreen() {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const [days, setDays] = useState<BadDayMeals[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      let isActive = true;
      setIsLoading(true);

      createEncryptedDb()
        .then(async (db) => {
          const [meals, entries] = await Promise.all([listMeals(db, null), listDiaryEntries(db)]);
          if (isActive) {
            setDays(buildBadDayMeals(meals, entries));
            setError(null);
            setIsLoading(false);
          }
        })
        .catch((loadError: unknown) => {
          console.error('[Ernährung] Auswertung fehlgeschlagen:', loadError);
          if (isActive) {
            setError('Die Auswertung konnte nicht geladen werden.');
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
        <SkeletonList count={3} lines={2} />
      ) : days.length === 0 ? (
        <EmptyState
          title={NO_CORRELATION_TITLE}
          description={NO_CORRELATION_DESCRIPTION}
          showGhost={false}
        />
      ) : (
        <BadDayMealsView days={days} />
      )}
    </View>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    errorBanner: {
      backgroundColor: colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: colors.danger,
      padding: tokens.spacing.sm,
    },
    errorText: { color: colors.danger, fontSize: tokens.typography.fontSize.sm, textAlign: 'center' },
  });
}
