import { useCallback, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { Pressable, Text, View, StyleSheet } from 'react-native';
import { createEncryptedDb } from '../../../../src/db/client';
import { createMeal, listMeals, deleteMeal } from '../../../../src/features/nutrition/db/mealsRepository';
import {
  toEatenAtIso,
  formatMealCountLabel,
  EMPTY_MEALS_TITLE,
  EMPTY_MEALS_DESCRIPTION,
} from '../../../../src/features/nutrition/meals';
import { MealComposer, isComposerReady } from '../../../../src/features/nutrition/components/MealComposer';
import { MealList } from '../../../../src/features/nutrition/components/MealList';
import { formatLocalDateKey } from '../../../../src/lib/localDate';
import { EmptyState } from '../../../../src/components/ui/EmptyState';
import { SkeletonList } from '../../../../src/components/ui/SkeletonList';
import { UndoBar } from '../../../../src/components/ui/UndoBar';
import { usePendingDeletion } from '../../../../src/features/deletion/usePendingDeletion';
import { saveFeedback } from '../../../../src/lib/haptics';
import { useTheme } from '../../../../src/theme/ThemeContext';
import { tokens } from '../../../../src/styles/tokens';
import type { Meal } from '../../../../src/features/nutrition/types';
import type { ThemeColors } from '../../../../src/theme/types';

function currentTime(now: Date): string {
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
}

export default function ErnaehrungsTagebuchScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const [meals, setMeals] = useState<Meal[]>([]);
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(() => formatLocalDateKey(new Date()));
  const [time, setTime] = useState(() => currentTime(new Date()));
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      let isActive = true;
      setIsLoading(true);

      createEncryptedDb()
        .then((db) => listMeals(db, null))
        .then((loaded) => {
          if (isActive) {
            setMeals(loaded);
            setError(null);
            setIsLoading(false);
          }
        })
        .catch((loadError: unknown) => {
          console.error('[Ernährung] Mahlzeiten konnten nicht geladen werden:', loadError);
          if (isActive) {
            setError('Mahlzeiten konnten nicht geladen werden.');
            setIsLoading(false);
          }
        });

      return () => {
        isActive = false;
      };
    }, [])
  );

  const { pending, requestDelete, undo } = usePendingDeletion<number>(async (mealId) => {
    try {
      const db = await createEncryptedDb();
      await deleteMeal(db, mealId);
      setMeals(await listMeals(db, null));
      setError(null);
    } catch (deleteError: unknown) {
      console.error('[Ernährung] Mahlzeit löschen fehlgeschlagen:', deleteError);
      setError('Mahlzeit konnte nicht gelöscht werden.');
    }
  });

  async function handleAdd() {
    if (!isComposerReady(description, date, time)) {
      setError('Bitte eine Mahlzeit, ein gültiges Datum und eine Uhrzeit angeben.');
      return;
    }
    try {
      const db = await createEncryptedDb();
      await createMeal(db, {
        eatenAt: toEatenAtIso(date, time),
        description: description.trim(),
      });
      setMeals(await listMeals(db, null));
      // Datum und Uhrzeit bleiben stehen: Wer drei Mahlzeiten am Stueck
      // nachtraegt, tippt das Datum nicht dreimal.
      setDescription('');
      setError(null);
      saveFeedback();
    } catch (addError: unknown) {
      console.error('[Ernährung] Mahlzeit speichern fehlgeschlagen:', addError);
      setError('Mahlzeit konnte nicht gespeichert werden.');
    }
  }

  const visible = meals.filter((meal) => pending === null || meal.id !== pending.id);

  return (
    <View style={styles.container}>
      {error && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      <MealComposer
        description={description}
        onDescriptionChange={setDescription}
        date={date}
        onDateChange={setDate}
        time={time}
        onTimeChange={setTime}
        onSubmit={() => void handleAdd()}
      />

      <View style={styles.statusRow}>
        <Text style={styles.countText}>{formatMealCountLabel(visible.length)}</Text>
        <Pressable
          accessibilityRole="link"
          accessibilityLabel="Auswertung vor auffälligen Tagen öffnen"
          onPress={() => router.push('/tagebuch/ernaehrung/auswertung')}
        >
          <Text style={styles.linkText}>Auswertung</Text>
        </Pressable>
      </View>

      {isLoading ? (
        <SkeletonList count={3} lines={1} />
      ) : visible.length === 0 && pending === null ? (
        <EmptyState title={EMPTY_MEALS_TITLE} description={EMPTY_MEALS_DESCRIPTION} />
      ) : (
        <MealList meals={visible} onDelete={(meal) => requestDelete({ id: meal.id, label: 'Mahlzeit' })} />
      )}

      {pending !== null && (
        <UndoBar label={`${pending.label} gelöscht`} onUndo={undo} avoidsFloatingButton={false} />
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
    statusRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: tokens.spacing.lg,
      paddingTop: tokens.spacing.md,
    },
    countText: { color: colors.textSecondary, fontSize: tokens.typography.fontSize.sm },
    linkText: {
      color: colors.primary,
      fontSize: tokens.typography.fontSize.md,
      fontWeight: tokens.typography.fontWeight.medium,
    },
  });
}
