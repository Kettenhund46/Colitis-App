import { useCallback, useState } from 'react';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { Text, View, StyleSheet } from 'react-native';
import { createEncryptedDb } from '../../../../src/db/client';
import { getDoctorVisitById, updateDoctorVisit } from '../../../../src/features/doctorVisits/db/doctorVisitsRepository';
import { rescheduleAppointmentReminder } from '../../../../src/features/doctorVisits/scheduleAppointmentReminder';
import { DoctorVisitForm } from '../../../../src/features/doctorVisits/components/DoctorVisitForm';
import { saveFeedback } from '../../../../src/lib/haptics';
import { useTheme } from '../../../../src/theme/ThemeContext';
import { tokens } from '../../../../src/styles/tokens';
import type { DoctorVisit, DoctorVisitInput } from '../../../../src/features/doctorVisits/types';
import type { ThemeColors } from '../../../../src/theme/types';

export default function ArztbesuchBearbeitenScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const { id } = useLocalSearchParams<{ id: string }>();
  const visitId = Number(id);
  const [visit, setVisit] = useState<DoctorVisit | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let isActive = true;

      createEncryptedDb()
        .then((db) => getDoctorVisitById(db, visitId))
        .then((loaded) => {
          if (isActive) {
            setVisit(loaded);
            setLoadError(loaded ? null : 'Arztbesuch wurde nicht gefunden.');
          }
        })
        .catch((error: unknown) => {
          console.error('[Arztbesuche] Laden zum Bearbeiten fehlgeschlagen:', error);
          if (isActive) {
            setLoadError('Arztbesuch konnte nicht geladen werden.');
          }
        });

      return () => {
        isActive = false;
      };
    }, [visitId])
  );

  async function handleSubmit(input: DoctorVisitInput) {
    try {
      const db = await createEncryptedDb();
      await updateDoctorVisit(db, visitId, input);
      await rescheduleAppointmentReminder(db, visitId);
      setSaveError(null);
      saveFeedback();
      router.back();
    } catch (error: unknown) {
      console.error('[Arztbesuche] Bearbeiten fehlgeschlagen:', error);
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

  if (!visit) {
    return (
      <View style={styles.container}>
        <Text style={styles.loadingText}>Arztbesuch wird geladen …</Text>
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
      <DoctorVisitForm
        initialState={{
          visitDate: visit.visitDate,
          doctorName: visit.doctorName ?? '',
          reason: visit.reason ?? '',
          note: visit.note ?? '',
          nextAppointmentDate: visit.nextAppointmentDate ?? '',
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
