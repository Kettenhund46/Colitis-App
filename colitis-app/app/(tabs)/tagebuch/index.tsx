import { useCallback, useState } from 'react';
import { Stack, useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Alert, Pressable, Text, View, StyleSheet } from 'react-native';
import { createEncryptedDb } from '../../../src/db/client';
import { listDiaryEntries, deleteDiaryEntry } from '../../../src/features/diary/db/diaryRepository';
import { exportDiaryEntriesAsPdf } from '../../../src/features/diary/diaryPdfExport';
import { exportDiaryEntriesAsCsv } from '../../../src/features/diary/diaryCsvExport';
import { shouldShowFlareWarning } from '../../../src/features/diary/flareWarning';
import { DiaryHistoryList } from '../../../src/features/diary/components/DiaryHistoryList';
import { DiaryCalendarView } from '../../../src/features/diary/components/DiaryCalendarView';
import { FlareWarningBanner } from '../../../src/features/diary/components/FlareWarningBanner';
import { SwipeableTabScreen } from '../../../src/components/SwipeableTabScreen';
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

  function handleOpenExportMenu() {
    if (entries.length === 0) {
      Alert.alert('Tagebuch exportieren', 'Noch keine Einträge zum Exportieren.', [
        { text: 'OK', style: 'cancel' },
      ]);
      return;
    }

    Alert.alert('Tagebuch exportieren', undefined, [
      { text: 'Als PDF exportieren', onPress: () => void handleExportPdf() },
      { text: 'Als CSV exportieren', onPress: () => void handleExportCsv() },
      { text: 'Abbrechen', style: 'cancel' },
    ]);
  }

  const showFlareWarning = !isFlareWarningDismissed && shouldShowFlareWarning(entries, new Date());

  return (
    <SwipeableTabScreen tab="tagebuch" style={styles.container}>
      <Stack.Screen
        options={{
          headerRight: () => (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Export-Menü öffnen"
              accessibilityState={{ disabled: isExporting }}
              disabled={isExporting}
              style={[styles.headerButton, isExporting && styles.headerButtonDisabled]}
              onPress={handleOpenExportMenu}
            >
              <Ionicons name="ellipsis-vertical" size={22} color={colors.textPrimary} />
            </Pressable>
          ),
        }}
      />
      {showFlareWarning && <FlareWarningBanner onDismiss={() => setIsFlareWarningDismissed(true)} />}
      {error && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}
      {isExporting && (
        <View style={styles.statusBanner}>
          <Text style={styles.statusText}>Export wird erstellt …</Text>
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
      <View style={styles.chipRow}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Muster-Auswertung ansehen"
          style={styles.chip}
          onPress={() => router.push('/tagebuch/auswertung')}
        >
          <Text style={styles.chipText}>Auswertung</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Arztbesuche verwalten"
          style={styles.chip}
          onPress={() => router.push('/tagebuch/arztbesuche')}
        >
          <Text style={styles.chipText}>Arztbesuche</Text>
        </Pressable>
      </View>
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
        accessibilityLabel="Schnell-Eintrag öffnen"
        style={styles.addButton}
        onPress={() => router.push('/tagebuch/schnell')}
      >
        <Text style={styles.addButtonText}>+</Text>
      </Pressable>
    </SwipeableTabScreen>
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
    statusBanner: {
      backgroundColor: colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: colors.primary,
      padding: tokens.spacing.sm,
    },
    statusText: {
      color: colors.textSecondary,
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
    chipRow: {
      flexDirection: 'row',
      gap: tokens.spacing.sm,
      backgroundColor: colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      paddingHorizontal: tokens.spacing.md,
      paddingVertical: tokens.spacing.sm,
    },
    chip: {
      flex: 1,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: tokens.radius.pill,
      paddingVertical: tokens.spacing.sm,
      paddingHorizontal: tokens.spacing.md,
    },
    chipText: {
      color: colors.primary,
      fontSize: tokens.typography.fontSize.sm,
      fontWeight: tokens.typography.fontWeight.medium,
    },
    headerButton: {
      paddingHorizontal: tokens.spacing.sm,
      paddingVertical: tokens.spacing.xs,
    },
    headerButtonDisabled: {
      opacity: 0.5,
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
