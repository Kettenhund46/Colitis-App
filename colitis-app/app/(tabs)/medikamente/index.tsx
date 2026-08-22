import { useCallback, useEffect, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { Alert, Pressable, Text, View, StyleSheet } from 'react-native';
import { createEncryptedDb } from '../../../src/db/client';
import {
  listMedications,
  logMedicationTaken,
  listMedicationIntakes,
  endMedication,
  deleteMedication,
} from '../../../src/features/medications/db/medicationsRepository';
import { formatLocalDate } from '../../../src/features/medications/medicationStatus';
import {
  buildTodaySummary,
  countByMedication,
  intakesOnDate,
  queryLowerBoundIso,
} from '../../../src/features/medications/adherence';
import { TodaySummaryLine } from '../../../src/features/medications/components/TodaySummaryLine';
import type { TodaySummary } from '../../../src/features/medications/adherence';
import {
  getScreeningReminder,
  upsertScreeningReminder,
  setScreeningReminderNotificationId,
  deleteScreeningReminder,
} from '../../../src/features/medications/db/screeningRepository';
import {
  configureNotificationHandling,
  requestNotificationPermission,
  cancelScheduledReminder,
  scheduleScreeningReminder,
} from '../../../src/lib/notifications/notificationService';
import { buildScreeningReminderContent } from '../../../src/features/medications/notifications/reminderContent';
import { exportMedicationPass } from '../../../src/features/medications/medicationPassExport';
import { MedicationList } from '../../../src/features/medications/components/MedicationList';
import { ScreeningReminderCard } from '../../../src/features/medications/components/ScreeningReminderCard';
import { SwipeableTabScreen } from '../../../src/components/SwipeableTabScreen';
import { SkeletonList } from '../../../src/components/ui/SkeletonList';
import { UndoBar } from '../../../src/components/ui/UndoBar';
import { usePendingDeletion } from '../../../src/features/deletion/usePendingDeletion';
import { useTheme } from '../../../src/theme/ThemeContext';
import { tokens } from '../../../src/styles/tokens';
import type {
  Medication,
  ScreeningReminder,
  NewScreeningReminderInput,
} from '../../../src/features/medications/types';
import type { ThemeColors } from '../../../src/theme/types';

export default function MedikamenteScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const [medications, setMedications] = useState<Medication[]>([]);
  const [takenTodayCounts, setTakenTodayCounts] = useState<Map<number, number>>(new Map());
  const [todaySummary, setTodaySummary] = useState<TodaySummary | null>(null);
  const [screeningReminder, setScreeningReminder] = useState<ScreeningReminder | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    configureNotificationHandling();
  }, []);

  useFocusEffect(
    useCallback(() => {
      let isActive = true;
      setIsLoading(true);

      createEncryptedDb()
        .then(async (db) => {
          const today = formatLocalDate(new Date());
          const [loadedMedications, loadedScreening, loadedIntakes] = await Promise.all([
            listMedications(db),
            getScreeningReminder(db),
            listMedicationIntakes(db, queryLowerBoundIso(today)),
          ]);
          if (isActive) {
            setMedications(loadedMedications);
            setScreeningReminder(loadedScreening);
            setTakenTodayCounts(countByMedication(intakesOnDate(loadedIntakes, today)));
            setTodaySummary(buildTodaySummary(loadedMedications, loadedIntakes, today));
            setError(null);
            setIsLoading(false);
          }
        })
        .catch((loadError: unknown) => {
          console.error('[Medikamente] Laden fehlgeschlagen:', loadError);
          if (isActive) {
            setError('Medikamente konnten nicht geladen werden.');
            setIsLoading(false);
          }
        });

      return () => {
        isActive = false;
      };
    }, [])
  );

  async function handleTakenToday(medicationId: number) {
    try {
      const db = await createEncryptedDb();
      await logMedicationTaken(db, medicationId, new Date().toISOString());
      const today = formatLocalDate(new Date());
      const intakes = await listMedicationIntakes(db, queryLowerBoundIso(today));
      setTakenTodayCounts(countByMedication(intakesOnDate(intakes, today)));
      setTodaySummary(buildTodaySummary(medications, intakes, today));
      setError(null);
    } catch (takenError: unknown) {
      console.error('[Medikamente] Eintragen der Einnahme fehlgeschlagen:', takenError);
      setError('Einnahme konnte nicht gespeichert werden.');
    }
  }

  function handleEnd(medicationId: number) {
    const medication = medications.find((entry) => entry.id === medicationId);
    if (!medication) {
      return;
    }
    Alert.alert('Medikament beenden?', `„${medication.name}“ wird als beendet markiert, bleibt aber in der Liste.`, [
      { text: 'Abbrechen', style: 'cancel' },
      {
        text: 'Beenden',
        style: 'destructive',
        onPress: () => void confirmEnd(medicationId),
      },
    ]);
  }

  async function confirmEnd(medicationId: number) {
    try {
      const db = await createEncryptedDb();
      const reminderTimes = await endMedication(db, medicationId, formatLocalDate(new Date()));
      for (const reminderTime of reminderTimes) {
        if (reminderTime.notificationId) {
          await cancelScheduledReminder(reminderTime.notificationId);
        }
      }
      setMedications(await listMedications(db));
      setError(null);
    } catch (endError: unknown) {
      console.error('[Medikamente] Beenden fehlgeschlagen:', endError);
      setError('Medikament konnte nicht beendet werden.');
    }
  }

  const { pending, requestDelete, undo } = usePendingDeletion<number>(async (medicationId) => {
    try {
      const db = await createEncryptedDb();
      const reminderTimes = await deleteMedication(db, medicationId);
      for (const reminderTime of reminderTimes) {
        if (reminderTime.notificationId) {
          await cancelScheduledReminder(reminderTime.notificationId);
        }
      }
      setMedications(await listMedications(db));
      setError(null);
    } catch (deleteError: unknown) {
      console.error('[Medikamente] Medikament löschen fehlgeschlagen:', deleteError);
      setError('Medikament konnte nicht gelöscht werden.');
    }
  });

  function handleDelete(medicationId: number) {
    const medication = medications.find((entry) => entry.id === medicationId);
    if (!medication) {
      return;
    }
    requestDelete({ id: medicationId, label: medication.name });
  }

  async function handleSaveScreeningReminder(input: NewScreeningReminderInput) {
    try {
      const db = await createEncryptedDb();
      const { previous, current } = await upsertScreeningReminder(db, input);

      if (previous?.notificationId) {
        await cancelScheduledReminder(previous.notificationId);
      }

      let notificationId: string | null = null;
      const granted = await requestNotificationPermission();
      if (granted) {
        notificationId = await scheduleScreeningReminder(input.nextDueDate, buildScreeningReminderContent(input));
      }

      await setScreeningReminderNotificationId(db, current.id, notificationId);
      setScreeningReminder({ ...current, notificationId });
      setError(null);
    } catch (saveError: unknown) {
      console.error('[Medikamente] Vorsorge-Reminder speichern fehlgeschlagen:', saveError);
      setError('Vorsorge-Erinnerung konnte nicht gespeichert werden.');
    }
  }

  async function handleDeleteScreeningReminder() {
    try {
      const db = await createEncryptedDb();
      const deleted = await deleteScreeningReminder(db);
      if (deleted?.notificationId) {
        await cancelScheduledReminder(deleted.notificationId);
      }
      setScreeningReminder(null);
      setError(null);
    } catch (deleteError: unknown) {
      console.error('[Medikamente] Vorsorge-Erinnerung löschen fehlgeschlagen:', deleteError);
      setError('Vorsorge-Erinnerung konnte nicht gelöscht werden.');
    }
  }

  async function handleExportPass() {
    setIsExporting(true);
    try {
      await exportMedicationPass(medications);
      setError(null);
    } catch (exportError: unknown) {
      console.error('[Medikamente] Medikamenten-Pass-Export fehlgeschlagen:', exportError);
      setError('Medikamenten-Pass konnte nicht exportiert werden.');
    } finally {
      setIsExporting(false);
    }
  }

  return (
    <SwipeableTabScreen tab="medikamente" style={styles.container}>
      {error && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}
      <TodaySummaryLine summary={todaySummary} />
      <ScreeningReminderCard
        reminder={screeningReminder}
        onSave={handleSaveScreeningReminder}
        onDelete={handleDeleteScreeningReminder}
      />
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled: isExporting || medications.length === 0 }}
        accessibilityLabel="Medikamenten-Pass als PDF exportieren"
        disabled={isExporting || medications.length === 0}
        style={[styles.exportLink, (isExporting || medications.length === 0) && styles.exportLinkDisabled]}
        onPress={handleExportPass}
      >
        <Text style={styles.exportLinkText}>
          {isExporting ? 'PDF wird erstellt …' : 'Medikamenten-Pass als PDF exportieren'}
        </Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Einnahme-Verlauf öffnen"
        style={styles.historyLink}
        onPress={() => router.push('/medikamente/verlauf')}
      >
        <Text style={styles.historyLinkText}>Einnahme-Verlauf ansehen</Text>
      </Pressable>
      {isLoading ? (
        <SkeletonList count={3} lines={2} />
      ) : (
        <MedicationList
          onCreate={() => router.push('/medikamente/neu')}
          medications={medications}
          today={new Date()}
          takenTodayCounts={takenTodayCounts}
          onTakenToday={handleTakenToday}
          onEnd={handleEnd}
          onEdit={(medicationId) => router.push(`/medikamente/${medicationId}`)}
          onDelete={handleDelete}
          hiddenId={pending === null ? null : pending.id}
        />
      )}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Neues Medikament anlegen"
        style={styles.addButton}
        onPress={() => router.push('/medikamente/neu')}
      >
        <Text style={styles.addButtonText}>+</Text>
      </Pressable>
      {pending !== null && <UndoBar label={pending.label} onUndo={undo} />}
    </SwipeableTabScreen>
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
    historyLink: {
      backgroundColor: colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      padding: tokens.spacing.md,
    },
    historyLinkText: {
      color: colors.primary,
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
