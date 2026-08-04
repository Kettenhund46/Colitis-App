import { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { Pressable, Switch, Text, View, StyleSheet } from 'react-native';
import { createEncryptedDb } from '../../../src/db/client';
import {
  createDiaryEntry,
  listDiaryEntries,
  updateDiaryEntryQuickFields,
} from '../../../src/features/diary/db/diaryRepository';
import {
  findTodaysEntry,
  buildQuickEntryInput,
  buildQuickEntryUpdate,
} from '../../../src/features/diary/quickEntryLogic';
import { STOOL_CONSISTENCY_OPTIONS } from '../../../src/features/diary/constants';
import { useTheme } from '../../../src/theme/ThemeContext';
import { tokens } from '../../../src/styles/tokens';
import type { StoolConsistency } from '../../../src/features/diary/constants';
import type { DiaryEntryWithTriggers } from '../../../src/features/diary/types';
import type { ThemeColors } from '../../../src/theme/types';

export default function SchnellEintragScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const [todaysEntry, setTodaysEntry] = useState<DiaryEntryWithTriggers | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [hasBlood, setHasBlood] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isSavingRef = useRef(false);
  const isMountedRef = useRef(true);

  useEffect(
    () => () => {
      isMountedRef.current = false;
    },
    []
  );

  useFocusEffect(
    useCallback(() => {
      let isActive = true;
      setIsLoading(true);
      setHasBlood(false);

      createEncryptedDb()
        .then((db) => listDiaryEntries(db))
        .then((entries) => {
          if (isActive) {
            setTodaysEntry(findTodaysEntry(entries, new Date()));
            setError(null);
            setIsLoading(false);
          }
        })
        .catch((loadError: unknown) => {
          console.error('[Schnell-Eintrag] Laden des heutigen Stands fehlgeschlagen:', loadError);
          if (isActive) {
            setError('Heutiger Stand konnte nicht geladen werden.');
            setIsLoading(false);
          }
        });

      return () => {
        isActive = false;
      };
    }, [])
  );

  async function handleSelectConsistency(consistency: StoolConsistency) {
    if (isSavingRef.current) {
      return;
    }
    isSavingRef.current = true;
    setIsSaving(true);

    try {
      const db = await createEncryptedDb();
      const existing = findTodaysEntry(await listDiaryEntries(db), new Date());

      if (existing === null) {
        await createDiaryEntry(
          db,
          buildQuickEntryInput(consistency, hasBlood, new Date().toISOString())
        );
      } else {
        await updateDiaryEntryQuickFields(
          db,
          existing.id,
          buildQuickEntryUpdate(existing, consistency, hasBlood)
        );
      }

      const entries = await listDiaryEntries(db);
      if (isMountedRef.current) {
        setTodaysEntry(findTodaysEntry(entries, new Date()));
        setHasBlood(false);
        setError(null);
      }
    } catch (saveError: unknown) {
      console.error('[Schnell-Eintrag] Speichern fehlgeschlagen:', saveError);
      if (isMountedRef.current) {
        setError('Eintrag konnte nicht gespeichert werden.');
      }
    } finally {
      isSavingRef.current = false;
      if (isMountedRef.current) {
        setIsSaving(false);
      }
    }
  }

  const countLabel = isLoading
    ? 'wird geladen …'
    : todaysEntry === null
    ? 'Heute noch nichts erfasst'
    : `Heute: ${todaysEntry.stoolFrequency} erfasst`;

  const isBloodAlreadyRecorded = todaysEntry !== null && todaysEntry.hasBlood;
  const areButtonsDisabled = isLoading || isSaving;

  return (
    <View style={styles.container}>
      {error && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      <Text style={styles.countText}>{countLabel}</Text>

      {isBloodAlreadyRecorded ? (
        <Text style={styles.bloodNote}>Für heute ist Blut vermerkt</Text>
      ) : (
        <View style={styles.bloodRow}>
          <Text style={styles.bloodLabel}>mit Blut</Text>
          <Switch
            accessibilityLabel="Mit Blut erfassen"
            value={hasBlood}
            onValueChange={setHasBlood}
            disabled={areButtonsDisabled}
          />
        </View>
      )}

      <Text style={styles.hint}>Konsistenz wählen — das speichert:</Text>

      <View style={styles.consistencyRow}>
        {STOOL_CONSISTENCY_OPTIONS.map((option) => (
          <Pressable
            key={option.key}
            accessibilityRole="button"
            accessibilityLabel={`${option.label} erfassen`}
            accessibilityState={{ disabled: areButtonsDisabled }}
            disabled={areButtonsDisabled}
            style={[
              styles.consistencyButton,
              areButtonsDisabled && styles.consistencyButtonDisabled,
            ]}
            onPress={() => void handleSelectConsistency(option.key)}
          >
            <Text style={styles.consistencyButtonText}>{option.label}</Text>
          </Pressable>
        ))}
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Ausführlichen Eintrag anlegen"
        style={styles.fullFormLink}
        onPress={() => router.push('/tagebuch/neu')}
      >
        <Text style={styles.fullFormLinkText}>Ausführlichen Eintrag anlegen →</Text>
      </Pressable>
    </View>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
      padding: tokens.spacing.lg,
    },
    errorBanner: {
      backgroundColor: colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: colors.danger,
      padding: tokens.spacing.sm,
      marginBottom: tokens.spacing.md,
    },
    errorText: {
      color: colors.danger,
      fontSize: tokens.typography.fontSize.sm,
      textAlign: 'center',
    },
    countText: {
      color: colors.textPrimary,
      fontSize: tokens.typography.fontSize.lg,
      fontWeight: tokens.typography.fontWeight.bold,
      marginBottom: tokens.spacing.lg,
    },
    bloodRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: colors.surface,
      borderRadius: tokens.radius.md,
      paddingHorizontal: tokens.spacing.md,
      paddingVertical: tokens.spacing.sm,
      marginBottom: tokens.spacing.lg,
    },
    bloodLabel: {
      color: colors.textPrimary,
      fontSize: tokens.typography.fontSize.md,
    },
    bloodNote: {
      color: colors.danger,
      fontSize: tokens.typography.fontSize.md,
      fontWeight: tokens.typography.fontWeight.medium,
      marginBottom: tokens.spacing.lg,
    },
    hint: {
      color: colors.textSecondary,
      fontSize: tokens.typography.fontSize.sm,
      marginBottom: tokens.spacing.sm,
    },
    consistencyRow: {
      flexDirection: 'row',
      gap: tokens.spacing.sm,
    },
    consistencyButton: {
      flex: 1,
      backgroundColor: colors.accent,
      borderRadius: tokens.radius.md,
      paddingVertical: tokens.spacing.lg,
      alignItems: 'center',
      justifyContent: 'center',
    },
    consistencyButtonDisabled: {
      opacity: 0.5,
    },
    consistencyButtonText: {
      color: colors.surface,
      fontSize: tokens.typography.fontSize.sm,
      fontWeight: tokens.typography.fontWeight.bold,
    },
    fullFormLink: {
      marginTop: tokens.spacing.xl,
      padding: tokens.spacing.md,
      alignItems: 'center',
    },
    fullFormLinkText: {
      color: colors.primary,
      fontSize: tokens.typography.fontSize.sm,
      fontWeight: tokens.typography.fontWeight.medium,
    },
  });
}
