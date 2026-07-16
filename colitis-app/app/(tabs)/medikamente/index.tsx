import { useCallback, useEffect, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { Alert, Pressable, Text, View, StyleSheet } from 'react-native';
import { createEncryptedDb } from '../../../src/db/client';
import {
  listMedications,
  logMedicationTaken,
  listMedicationIdsTakenOn,
  deleteMedication,
} from '../../../src/features/medications/db/medicationsRepository';
import { formatLocalDate } from '../../../src/features/medications/medicationStatus';
import {
  getScreeningReminder,
  upsertScreeningReminder,
  setScreeningReminderNotificationId,
} from '../../../src/features/medications/db/screeningRepository';
import {
  configureNotificationHandling,
  requestNotificationPermission,
  cancelScheduledReminder,
  scheduleScreeningReminder,
} from '../../../src/features/medications/notifications/notificationService';
import { buildScreeningReminderContent } from '../../../src/features/medications/notifications/reminderContent';
import { MedicationList } from '../../../src/features/medications/components/MedicationList';
import { ScreeningReminderCard } from '../../../src/features/medications/components/ScreeningReminderCard';
import { tokens } from '../../../src/styles/tokens';
import type {
  Medication,
  ScreeningReminder,
  NewScreeningReminderInput,
} from '../../../src/features/medications/types';

export default function MedikamenteScreen() {
  const router = useRouter();
  const [medications, setMedications] = useState<Medication[]>([]);
  const [takenTodayIds, setTakenTodayIds] = useState<Set<number>>(new Set());
  const [screeningReminder, setScreeningReminder] = useState<ScreeningReminder | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    configureNotificationHandling();
  }, []);

  useFocusEffect(
    useCallback(() => {
      let isActive = true;
      setIsLoading(true);

      createEncryptedDb()
        .then(async (db) => {
          const [loadedMedications, loadedScreening, loadedTakenTodayIds] = await Promise.all([
            listMedications(db),
            getScreeningReminder(db),
            listMedicationIdsTakenOn(db, formatLocalDate(new Date())),
          ]);
          if (isActive) {
            setMedications(loadedMedications);
            setScreeningReminder(loadedScreening);
            setTakenTodayIds(new Set(loadedTakenTodayIds));
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
      setTakenTodayIds((current) => new Set(current).add(medicationId));
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
    Alert.alert('Medikament beenden?', `„${medication.name}“ wird aus der Liste gelöscht.`, [
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
      const reminderTimes = await deleteMedication(db, medicationId);
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

  return (
    <View style={styles.container}>
      {error && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}
      <ScreeningReminderCard reminder={screeningReminder} onSave={handleSaveScreeningReminder} />
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Medikamente werden geladen …</Text>
        </View>
      ) : (
        <MedicationList
          medications={medications}
          today={new Date()}
          takenTodayIds={takenTodayIds}
          onTakenToday={handleTakenToday}
          onEnd={handleEnd}
          onEdit={(medicationId) => router.push(`/medikamente/${medicationId}`)}
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: tokens.colors.background },
  errorBanner: {
    backgroundColor: tokens.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: tokens.colors.danger,
    padding: tokens.spacing.sm,
  },
  errorText: { color: tokens.colors.danger, fontSize: tokens.typography.fontSize.sm, textAlign: 'center' },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: tokens.spacing.lg,
  },
  loadingText: {
    color: tokens.colors.textSecondary,
    fontSize: tokens.typography.fontSize.md,
  },
  addButton: {
    position: 'absolute',
    right: tokens.spacing.lg,
    bottom: tokens.spacing.lg,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: tokens.colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
  },
  addButtonText: {
    color: tokens.colors.surface,
    fontSize: tokens.typography.fontSize.xl,
    fontWeight: tokens.typography.fontWeight.bold,
  },
});
