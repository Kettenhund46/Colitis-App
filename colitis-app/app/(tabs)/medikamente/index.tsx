import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { Alert, Pressable, Text, View, StyleSheet } from 'react-native';
import { createEncryptedDb } from '../../../src/db/client';
import { applyIntakeToSupply, refillSupply } from '../../../src/features/medications/scheduleSupplyReminder';
import { getPrescriptionLeadDays } from '../../../src/features/settings/settingsStorage';
import { DEFAULT_PRESCRIPTION_LEAD_DAYS } from '../../../src/features/medications/supply';
import { saveFeedback } from '../../../src/lib/haptics';
import {
  listMedications,
  logMedicationTaken,
  listMedicationIntakes,
  endMedication,
  deleteMedication,
} from '../../../src/features/medications/db/medicationsRepository';
import { formatLocalDate } from '../../../src/features/medications/medicationStatus';
import {
  countByMedication,
  intakesOnDate,
  queryLowerBoundIso,
} from '../../../src/features/medications/adherence';
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
import { UndoBar } from '../../../src/components/ui/UndoBar';
import { usePendingDeletion } from '../../../src/features/deletion/usePendingDeletion';
import { useTheme } from '../../../src/theme/ThemeContext';
import { tokens } from '../../../src/styles/tokens';
import type {
  Medication,
  MedicationIntake,
  ScreeningReminder,
  NewScreeningReminderInput,
} from '../../../src/features/medications/types';
import type { ThemeColors } from '../../../src/theme/types';

export default function MedikamenteScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const [medications, setMedications] = useState<Medication[]>([]);
  const [intakes, setIntakes] = useState<MedicationIntake[]>([]);
  const [screeningReminder, setScreeningReminder] = useState<ScreeningReminder | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [prescriptionLeadDays, setPrescriptionLeadDays] = useState(DEFAULT_PRESCRIPTION_LEAD_DAYS);
  const isSavingRef = useRef(false);

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
          const [loadedMedications, loadedScreening, loadedIntakes, loadedLeadDays] = await Promise.all([
            listMedications(db),
            getScreeningReminder(db),
            listMedicationIntakes(db, queryLowerBoundIso(today)),
            getPrescriptionLeadDays(),
          ]);
          if (isActive) {
            setMedications(loadedMedications);
            setScreeningReminder(loadedScreening);
            setIntakes(loadedIntakes);
            setPrescriptionLeadDays(loadedLeadDays);
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
    // Der Knopf schaltet erst ab, wenn alle faelligen Dosen erfasst sind. Ohne
    // diese Sperre schriebe ein zweiter Tipp waehrend des Speicherns eine
    // ueberzaehlige Zeile ins Protokoll -- und das ist die Zahl, die beim
    // Arztbesuch gezeigt wird.
    if (isSavingRef.current) {
      return;
    }
    isSavingRef.current = true;

    try {
      const db = await createEncryptedDb();
      await logMedicationTaken(db, medicationId, new Date().toISOString());
      // Der Vorrat sinkt mit der Einnahme, und damit verschiebt sich der
      // Zeitpunkt der Rezept-Erinnerung -- beides gehoert in denselben Schritt.
      await applyIntakeToSupply(db, medicationId, await getPrescriptionLeadDays());
      setMedications(await listMedications(db));
      setIntakes(await listMedicationIntakes(db, queryLowerBoundIso(formatLocalDate(new Date()))));
      setError(null);
    } catch (takenError: unknown) {
      console.error('[Medikamente] Eintragen der Einnahme fehlgeschlagen:', takenError);
      setError('Einnahme konnte nicht gespeichert werden.');
    } finally {
      isSavingRef.current = false;
    }
  }

  async function handleRefill(medicationId: number) {
    try {
      const db = await createEncryptedDb();
      await refillSupply(db, medicationId, prescriptionLeadDays);
      setMedications(await listMedications(db));
      saveFeedback();
      setError(null);
    } catch (refillError: unknown) {
      console.error('[Medikamente] Packung nachlegen fehlgeschlagen:', refillError);
      setError('Der Vorrat konnte nicht aktualisiert werden.');
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
      setIntakes(await listMedicationIntakes(db, queryLowerBoundIso(formatLocalDate(new Date()))));
      setError(null);
    } catch (deleteError: unknown) {
      console.error('[Medikamente] Medikament löschen fehlgeschlagen:', deleteError);
      setError('Medikament konnte nicht gelöscht werden.');
    }
  });

  const takenTodayCounts = useMemo(
    () => countByMedication(intakesOnDate(intakes, formatLocalDate(new Date()))),
    [intakes]
  );

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

  // Wandert als Fussbereich in die Liste und scrollt mit. Unter den Karten,
  // nicht darueber: Der Tab heisst Medikamente, und die Vorsorge-Karte fuellt
  // aufgeklappt den halben Schirm -- oben haette sie den Leerzustand samt
  // "Erstes Medikament anlegen" unter den Rand geschoben.
  const listFooter = (
    <ScreeningReminderCard
      reminder={screeningReminder}
      onSave={handleSaveScreeningReminder}
      onDelete={handleDeleteScreeningReminder}
    />
  );

  return (
    <SwipeableTabScreen tab="medikamente" style={styles.container}>
      {error && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}
      {/* Steht fest oben, wie die PDF-Ausgabe im Arztbesuche-Bildschirm. */}
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
      {/* Chip statt voller Leiste, wie "Auswertung" und "Arztbesuche" im
          Tagebuch. Als Leiste direkt unter der Vorsorge-Karte las er sich als
          deren letzte Zeile -- beide auf derselben hellen Flaeche. */}
      <View style={styles.chipRow}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Einnahme-Verlauf öffnen"
          style={styles.chip}
          onPress={() => router.push('/medikamente/verlauf')}
        >
          <Text style={styles.chipText}>Einnahme-Verlauf</Text>
        </Pressable>
      </View>
      <MedicationList
        footer={listFooter}
        isLoading={isLoading}
        onCreate={() => router.push('/medikamente/neu')}
        medications={medications}
        today={new Date()}
        takenTodayCounts={takenTodayCounts}
        onTakenToday={handleTakenToday}
        onEnd={handleEnd}
        onEdit={(medicationId) => router.push(`/medikamente/${medicationId}`)}
        onDelete={handleDelete}
      onRefill={handleRefill}
      prescriptionLeadDays={prescriptionLeadDays}
        hiddenId={pending === null ? null : pending.id}
      />
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
