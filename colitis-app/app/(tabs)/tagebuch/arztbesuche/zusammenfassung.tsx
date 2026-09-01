import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { Pressable, Text, View, StyleSheet } from 'react-native';
import { createEncryptedDb } from '../../../../src/db/client';
import { listDiaryEntries } from '../../../../src/features/diary/db/diaryRepository';
import {
  listMedications,
  listMedicationIntakes,
} from '../../../../src/features/medications/db/medicationsRepository';
import { getScreeningReminder } from '../../../../src/features/medications/db/screeningRepository';
import { getNormalStoolFrequency } from '../../../../src/features/settings/settingsStorage';
import { listDoctorVisits } from '../../../../src/features/doctorVisits/db/doctorVisitsRepository';
import { buildVisitSummary } from '../../../../src/features/doctorVisits/visitSummary';
import { exportVisitSummary } from '../../../../src/features/doctorVisits/visitSummaryExport';
import { VisitSummaryView } from '../../../../src/features/doctorVisits/components/VisitSummaryView';
import { EmptyState } from '../../../../src/components/ui/EmptyState';
import { SkeletonList } from '../../../../src/components/ui/SkeletonList';
import { formatLocalDateKey } from '../../../../src/lib/localDate';
import { useTheme } from '../../../../src/theme/ThemeContext';
import { tokens } from '../../../../src/styles/tokens';
import type { VisitSummary } from '../../../../src/features/doctorVisits/visitSummary';
import type { ThemeColors } from '../../../../src/theme/types';

export default function ZusammenfassungScreen() {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const [summary, setSummary] = useState<VisitSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let isActive = true;
      setIsLoading(true);

      createEncryptedDb()
        .then(async (db) => {
          const [entries, medications, intakes, visits, screening] = await Promise.all([
            listDiaryEntries(db),
            listMedications(db),
            listMedicationIntakes(db, null),
            listDoctorVisits(db),
            getScreeningReminder(db),
          ]);
          const normalStoolFrequency = await getNormalStoolFrequency();
          if (isActive) {
            setSummary(
              buildVisitSummary({
                entries,
                medications,
                intakes,
                visits,
                screening,
                normalStoolFrequency,
                today: formatLocalDateKey(new Date()),
              })
            );
            setError(null);
            setIsLoading(false);
          }
        })
        .catch((loadError: unknown) => {
          console.error('[Zusammenfassung] Laden fehlgeschlagen:', loadError);
          if (isActive) {
            setError('Zusammenfassung konnte nicht geladen werden.');
            setIsLoading(false);
          }
        });

      return () => {
        isActive = false;
      };
    }, [])
  );

  async function handleExport() {
    if (summary === null) {
      return;
    }
    setIsExporting(true);
    try {
      await exportVisitSummary(summary);
      setError(null);
    } catch (exportError: unknown) {
      console.error('[Zusammenfassung] PDF-Ausgabe fehlgeschlagen:', exportError);
      setError('PDF konnte nicht erstellt werden.');
    } finally {
      setIsExporting(false);
    }
  }

  function renderBody() {
    if (isLoading || summary === null) {
      return <SkeletonList count={4} lines={2} />;
    }
    if (summary.isEmpty) {
      return (
        <EmptyState
          title="Noch nichts zusammenzufassen"
          description="Für diesen Zeitraum gibt es weder Tagebucheinträge noch hinterlegte Medikamente."
          showGhost={false}
        />
      );
    }
    return <VisitSummaryView summary={summary} />;
  }

  const isShareDisabled = isLoading || summary === null || summary.isEmpty || isExporting;

  return (
    <View style={styles.container}>
      {error && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled: isShareDisabled }}
        accessibilityLabel="Zusammenfassung als PDF teilen"
        disabled={isShareDisabled}
        style={[styles.shareLink, isShareDisabled && styles.shareLinkDisabled]}
        onPress={() => void handleExport()}
      >
        <Text style={styles.shareLinkText}>
          {isExporting ? 'PDF wird erstellt …' : 'Als PDF teilen'}
        </Text>
      </Pressable>
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
    shareLink: {
      backgroundColor: colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      padding: tokens.spacing.md,
    },
    shareLinkDisabled: { opacity: 0.5 },
    shareLinkText: {
      color: colors.primary,
      fontSize: tokens.typography.fontSize.sm,
      fontWeight: tokens.typography.fontWeight.medium,
      textAlign: 'center',
    },
  });
}
