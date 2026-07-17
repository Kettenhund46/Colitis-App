import { useCallback, useState } from 'react';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { Text, View, StyleSheet } from 'react-native';
import { createEncryptedDb } from '../../../src/db/client';
import {
  getMedicationById,
  updateMedication,
  setReminderTimeNotificationId,
} from '../../../src/features/medications/db/medicationsRepository';
import {
  requestNotificationPermission,
  scheduleDailyReminder,
  cancelScheduledReminder,
} from '../../../src/features/medications/notifications/notificationService';
import { buildMedicationReminderContent } from '../../../src/features/medications/notifications/reminderContent';
import { MedicationForm } from '../../../src/features/medications/components/MedicationForm';
import { useTheme } from '../../../src/theme/ThemeContext';
import { tokens } from '../../../src/styles/tokens';
import type { Medication, MedicationInput } from '../../../src/features/medications/types';
import type { ThemeColors } from '../../../src/theme/types';

export default function MedikamentBearbeitenScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const { id } = useLocalSearchParams<{ id: string }>();
  const medicationId = Number(id);
  const [medication, setMedication] = useState<Medication | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let isActive = true;

      createEncryptedDb()
        .then((db) => getMedicationById(db, medicationId))
        .then((loaded) => {
          if (isActive) {
            setMedication(loaded);
            setLoadError(loaded ? null : 'Medikament wurde nicht gefunden.');
          }
        })
        .catch((error: unknown) => {
          console.error('[Medikamente] Laden zum Bearbeiten fehlgeschlagen:', error);
          if (isActive) {
            setLoadError('Medikament konnte nicht geladen werden.');
          }
        });

      return () => {
        isActive = false;
      };
    }, [medicationId])
  );

  async function handleSubmit(input: MedicationInput) {
    try {
      const db = await createEncryptedDb();
      const { removed, inserted } = await updateMedication(db, medicationId, input);

      for (const reminderTime of removed) {
        if (reminderTime.notificationId) {
          await cancelScheduledReminder(reminderTime.notificationId);
        }
      }

      if (inserted.length > 0) {
        const granted = await requestNotificationPermission();
        if (granted) {
          for (const reminderTime of inserted) {
            const notificationId = await scheduleDailyReminder(
              reminderTime.time,
              buildMedicationReminderContent(input)
            );
            await setReminderTimeNotificationId(db, reminderTime.id, notificationId);
          }
        }
      }

      setSaveError(null);
      router.back();
    } catch (error: unknown) {
      console.error('[Medikamente] Bearbeiten fehlgeschlagen:', error);
      setSaveError('Änderungen konnten nicht gespeichert werden.');
    }
  }

  if (loadError) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>{loadError}</Text>
      </View>
    );
  }

  if (!medication) {
    return (
      <View style={styles.container}>
        <Text style={styles.loadingText}>Medikament wird geladen …</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {saveError && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{saveError}</Text>
        </View>
      )}
      <MedicationForm
        initialState={{
          name: medication.name,
          dose: medication.dose,
          schedule: medication.schedule,
          startDate: medication.startDate,
          endDate: medication.endDate ?? '',
          reminderTimes: medication.reminderTimes.map((reminderTime) => reminderTime.time),
        }}
        onSubmit={handleSubmit}
        submitLabel="Änderungen speichern"
      />
    </View>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background, padding: tokens.spacing.lg },
    errorBanner: {
      backgroundColor: colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: colors.danger,
      padding: tokens.spacing.sm,
    },
    errorText: { color: colors.danger, fontSize: tokens.typography.fontSize.sm, textAlign: 'center' },
    loadingText: { color: colors.textSecondary, fontSize: tokens.typography.fontSize.md, textAlign: 'center' },
  });
}
