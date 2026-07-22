import { useCallback, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { Alert, Pressable, Text, View, StyleSheet } from 'react-native';
import { createEncryptedDb } from '../../../src/db/client';
import { listDiaryEntries, deleteDiaryEntry } from '../../../src/features/diary/db/diaryRepository';
import { exportDiaryEntriesAsPdf } from '../../../src/features/diary/diaryPdfExport';
import { exportDiaryEntriesAsCsv } from '../../../src/features/diary/diaryCsvExport';
import { shouldShowFlareWarning } from '../../../src/features/diary/flareWarning';
import { DiaryHistoryList } from '../../../src/features/diary/components/DiaryHistoryList';
import { DiaryCalendarView } from '../../../src/features/diary/components/DiaryCalendarView';
import { FlareWarningBanner } from '../../../src/features/diary/components/FlareWarningBanner';
import { useTheme } from '../../../src/theme/ThemeContext';
import { tokens } from '../../../src/styles/tokens';
import type { DiaryEntryWithTriggers } from '../../../src/features/diary/types';
import type { ThemeColors } from '../../../src/theme/types';

export default function TagebuchScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const [entries, setEntries] = useState<DiaryEntryWithTriggers[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');
  const [isFlareWarningDismissed, setIsFlareWarningDismissed] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let isActive = true;
      setIsLoading(true);

      createEncryptedDb()
        .then((db) => listDiaryEntries(db))
        .then((loadedEntries) => {
          if (isActive) {
            setEntries(loadedEntries);
            setError(null);
            setIsLoading(false);
          }
        })
        .catch((loadError: unknown) => {
          console.error('[Tagebuch] Laden der Einträge fehlgeschlagen:', loadError);
          if (isActive) {
            setError('Einträge konnten nicht geladen werden.');
            setIsLoading(false);
          }
        });

      return () => {
        isActive = false;
      };
    }, [])
  );

  function handleDelete(entryId: number) {
    Alert.alert('Eintrag löschen?', 'Dieser Tagebucheintrag wird endgültig gelöscht.', [
      { text: 'Abbrechen', style: 'cancel' },
      {
        text: 'Löschen',
        style: 'destructive',
        onPress: () => void confirmDelete(entryId),
      },
    ]);
  }

  async function confirmDelete(entryId: number) {
    try {
      const db = await createEncryptedDb();
      await deleteDiaryEntry(db, entryId);
      setEntries(await listDiaryEntries(db));
      setError(null);
    } catch (deleteError: unknown) {
      console.error('[Tagebuch] Löschen fehlgeschlagen:', deleteError);
      setError('Eintrag konnte nicht gelöscht werden.');
    }
  }

  async function handleExportPdf() {
    setIsExporting(true);
    try {
      await exportDiaryEntriesAsPdf(entries);
      setError(null);
    } catch (exportError: unknown) {
      console.error('[Tagebuch] PDF-Export fehlgeschlagen:', exportError);
      setError('PDF-Export fehlgeschlagen.');
    } finally {
      setIsExporting(false);
    }
  }

  async function handleExportCsv() {
    setIsExporting(true);
    try {
      await exportDiaryEntriesAsCsv(entries);
      setError(null);
    } catch (exportError: unknown) {
      console.error('[Tagebuch] CSV-Export fehlgeschlagen:', exportError);
      setError('CSV-Export fehlgeschlagen.');
    } finally {
      setIsExporting(false);
    }
  }

  const showFlareWarning = !isFlareWarningDismissed && shouldShowFlareWarning(entries, new Date());

  return (
    <View style={styles.container}>
      {showFlareWarning && <FlareWarningBanner onDismiss={() => setIsFlareWarningDismissed(true)} />}
      {error && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}
      <View style={styles.viewToggleRow}>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ selected: viewMode === 'list' }}
          style={[styles.viewToggleButton, viewMode === 'list' && styles.viewToggleButtonActive]}
          onPress={() => setViewMode('list')}
        >
          <Text style={[styles.viewToggleButtonText, viewMode === 'list' && styles.viewToggleButtonTextActive]}>
            Liste
          </Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ selected: viewMode === 'calendar' }}
          style={[styles.viewToggleButton, viewMode === 'calendar' && styles.viewToggleButtonActive]}
          onPress={() => setViewMode('calendar')}
        >
          <Text style={[styles.viewToggleButtonText, viewMode === 'calendar' && styles.viewToggleButtonTextActive]}>
            Kalender
          </Text>
        </Pressable>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Muster-Auswertung ansehen"
        style={styles.analysisLink}
        onPress={() => router.push('/tagebuch/auswertung')}
      >
        <Text style={styles.analysisLinkText}>Muster-Auswertung ansehen →</Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled: isExporting || entries.length === 0 }}
        accessibilityLabel="Tagebuch als PDF exportieren"
        disabled={isExporting || entries.length === 0}
        style={[styles.exportLink, (isExporting || entries.length === 0) && styles.exportLinkDisabled]}
        onPress={handleExportPdf}
      >
        <Text style={styles.exportLinkText}>{isExporting ? 'PDF wird erstellt …' : 'Als PDF exportieren'}</Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled: isExporting || entries.length === 0 }}
        accessibilityLabel="Tagebuch als CSV exportieren"
        disabled={isExporting || entries.length === 0}
        style={[styles.exportLink, (isExporting || entries.length === 0) && styles.exportLinkDisabled]}
        onPress={handleExportCsv}
      >
        <Text style={styles.exportLinkText}>{isExporting ? 'CSV wird erstellt …' : 'Als CSV exportieren'}</Text>
      </Pressable>
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Einträge werden geladen …</Text>
        </View>
      ) : viewMode === 'list' ? (
        <DiaryHistoryList entries={entries} onDelete={handleDelete} />
      ) : (
        <DiaryCalendarView entries={entries} onDeleteEntry={handleDelete} />
      )}
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
    viewToggleRow: {
      flexDirection: 'row',
      backgroundColor: colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    viewToggleButton: {
      flex: 1,
      paddingVertical: tokens.spacing.md,
      alignItems: 'center',
    },
    viewToggleButtonActive: {
      borderBottomWidth: 2,
      borderBottomColor: colors.primary,
    },
    viewToggleButtonText: {
      color: colors.textSecondary,
      fontSize: tokens.typography.fontSize.sm,
      fontWeight: tokens.typography.fontWeight.medium,
    },
    viewToggleButtonTextActive: {
      color: colors.primary,
    },
    analysisLink: {
      backgroundColor: colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      padding: tokens.spacing.md,
    },
    analysisLinkText: {
      color: colors.primary,
      fontSize: tokens.typography.fontSize.sm,
      fontWeight: tokens.typography.fontWeight.medium,
      textAlign: 'center',
    },
    exportLink: {
      backgroundColor: colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      padding: tokens.spacing.md,
    },
    exportLinkDisabled: {
      opacity: 0.5,
    },
    exportLinkText: {
      color: colors.primary,
      fontSize: tokens.typography.fontSize.sm,
      fontWeight: tokens.typography.fontWeight.medium,
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
    addButton: {
      position: 'absolute',
      right: tokens.spacing.lg,
      bottom: tokens.spacing.lg,
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: colors.accent,
      alignItems: 'center',
      justifyContent: 'center',
      elevation: 4,
    },
    addButtonText: {
      color: colors.surface,
      fontSize: tokens.typography.fontSize.xl,
      fontWeight: tokens.typography.fontWeight.bold,
    },
  });
}
