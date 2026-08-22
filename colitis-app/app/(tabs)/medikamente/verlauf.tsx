import { useCallback, useMemo, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { Pressable, Text, View, StyleSheet } from 'react-native';
import { createEncryptedDb } from '../../../src/db/client';
import {
  listMedications,
  listMedicationIntakes,
} from '../../../src/features/medications/db/medicationsRepository';
import { formatLocalDate } from '../../../src/features/medications/medicationStatus';
import { buildDaySummaries, periodStartDate } from '../../../src/features/medications/adherence';
import { IntakeHistoryList } from '../../../src/features/medications/components/IntakeHistoryList';
import { EmptyState } from '../../../src/components/ui/EmptyState';
import { SkeletonList } from '../../../src/components/ui/SkeletonList';
import { useTheme } from '../../../src/theme/ThemeContext';
import { tokens } from '../../../src/styles/tokens';
import type { HistoryPeriod } from '../../../src/features/medications/adherence';
import type { Medication, MedicationIntake } from '../../../src/features/medications/types';
import type { ThemeColors } from '../../../src/theme/types';

const PERIOD_OPTIONS: { value: HistoryPeriod; label: string }[] = [
  { value: '30', label: '30 Tage' },
  { value: '90', label: '90 Tage' },
  { value: 'alles', label: 'Alles' },
];

export default function EinnahmeVerlaufScreen() {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const [period, setPeriod] = useState<HistoryPeriod>('30');
  const [medications, setMedications] = useState<Medication[]>([]);
  const [intakes, setIntakes] = useState<MedicationIntake[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let isActive = true;
      setIsLoading(true);

      createEncryptedDb()
        .then(async (db) => {
          const [loadedMedications, loadedIntakes] = await Promise.all([
            listMedications(db),
            listMedicationIntakes(db, null),
          ]);
          if (isActive) {
            setMedications(loadedMedications);
            setIntakes(loadedIntakes);
            setError(null);
            setIsLoading(false);
          }
        })
        .catch((loadError: unknown) => {
          console.error('[Einnahme-Verlauf] Laden fehlgeschlagen:', loadError);
          if (isActive) {
            setError('Einnahmen konnten nicht geladen werden.');
            setIsLoading(false);
          }
        });

      return () => {
        isActive = false;
      };
    }, [])
  );

  // Die Tagesliste laeuft ueber jeden Tag des Zeitraums und gruppiert dabei
  // alle Einnahmen. Bei "Alles" sind das schnell mehrere hundert Zeilen; das
  // bei jedem Tastendruck neu zu rechnen waere spuerbar.
  const summaries = useMemo(() => {
    const today = formatLocalDate(new Date());
    return buildDaySummaries(medications, intakes, periodStartDate(period, medications, today), today);
  }, [medications, intakes, period]);

  function renderBody() {
    if (isLoading) {
      return <SkeletonList count={4} lines={2} />;
    }
    if (medications.length === 0) {
      return (
        <EmptyState
          title="Noch keine Medikamente hinterlegt"
          description="Sobald du ein Medikament anlegst, hält der Verlauf fest, an welchen Tagen etwas fehlte."
          showGhost={false}
        />
      );
    }
    if (summaries.length === 0) {
      return (
        <EmptyState
          title="In diesem Zeitraum war nichts fällig"
          description="Wähle einen längeren Zeitraum, um weiter zurückzuschauen."
          showGhost={false}
        />
      );
    }
    return <IntakeHistoryList summaries={summaries} />;
  }

  return (
    <View style={styles.container}>
      {error && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      <View style={styles.periodRow}>
        {PERIOD_OPTIONS.map((option) => {
          const isSelected = option.value === period;
          return (
            <Pressable
              key={option.value}
              accessibilityRole="button"
              accessibilityState={{ selected: isSelected }}
              accessibilityLabel={`Zeitraum ${option.label}`}
              style={isSelected ? styles.periodChipSelected : styles.periodChip}
              onPress={() => setPeriod(option.value)}
            >
              <Text style={isSelected ? styles.periodChipTextSelected : styles.periodChipText}>
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {renderBody()}
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
    periodRow: {
      flexDirection: 'row',
      gap: tokens.spacing.sm,
      paddingHorizontal: tokens.spacing.lg,
      paddingTop: tokens.spacing.md,
    },
    periodChip: {
      borderRadius: tokens.radius.pill,
      borderWidth: 1,
      borderColor: colors.border,
      paddingVertical: tokens.spacing.xs,
      paddingHorizontal: tokens.spacing.md,
    },
    periodChipSelected: {
      borderRadius: tokens.radius.pill,
      borderWidth: 1,
      borderColor: colors.primary,
      backgroundColor: colors.primary,
      paddingVertical: tokens.spacing.xs,
      paddingHorizontal: tokens.spacing.md,
    },
    periodChipText: { color: colors.textSecondary, fontSize: tokens.typography.fontSize.sm },
    periodChipTextSelected: {
      color: colors.surface,
      fontSize: tokens.typography.fontSize.sm,
      fontWeight: tokens.typography.fontWeight.medium,
    },
  });
}
