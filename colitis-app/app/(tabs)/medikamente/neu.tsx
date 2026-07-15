import { useState } from 'react';
import { useRouter } from 'expo-router';
import { Text, View, StyleSheet } from 'react-native';
import { createEncryptedDb } from '../../../src/db/client';
import {
  createMedication,
  setReminderTimeNotificationId,
} from '../../../src/features/medications/db/medicationsRepository';
import {
  requestNotificationPermission,
  scheduleDailyReminder,
} from '../../../src/features/medications/notifications/notificationService';
import { buildMedicationReminderContent } from '../../../src/features/medications/notifications/reminderContent';
import { MedicationForm } from '../../../src/features/medications/components/MedicationForm';
import { tokens } from '../../../src/styles/tokens';
import type { MedicationInput } from '../../../src/features/medications/types';

export default function NeuesMedikamentScreen() {
  const router = useRouter();
  const [saveError, setSaveError] = useState<string | null>(null);

  async function handleSubmit(input: MedicationInput) {
    let created;
    try {
      const db = await createEncryptedDb();
      created = await createMedication(db, input);
    } catch (error: unknown) {
      console.error('[Medikamente] Anlegen fehlgeschlagen:', error);
      setSaveError('Medikament konnte nicht gespeichert werden.');
      return;
    }

    if (created.reminderTimes.length > 0) {
      try {
        const db = await createEncryptedDb();
        const granted = await requestNotificationPermission();
        if (granted) {
          for (const reminderTime of created.reminderTimes) {
            const notificationId = await scheduleDailyReminder(
              reminderTime.time,
              buildMedicationReminderContent(created)
            );
            await setReminderTimeNotificationId(db, reminderTime.id, notificationId);
          }
        }
      } catch (notificationError: unknown) {
        console.error('[Medikamente] Erinnerungen konnten nicht geplant werden:', notificationError);
      }
    }

    setSaveError(null);
    router.back();
  }

  return (
    <View style={styles.container}>
      {saveError && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{saveError}</Text>
        </View>
      )}
      <MedicationForm onSubmit={handleSubmit} submitLabel="Medikament speichern" />
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
});
