import { useState } from 'react';
import { useRouter } from 'expo-router';
import { Text, View, StyleSheet } from 'react-native';
import { createEncryptedDb } from '../../../../src/db/client';
import { createDoctorVisit } from '../../../../src/features/doctorVisits/db/doctorVisitsRepository';
import { DoctorVisitForm } from '../../../../src/features/doctorVisits/components/DoctorVisitForm';
import { useTheme } from '../../../../src/theme/ThemeContext';
import { tokens } from '../../../../src/styles/tokens';
import type { DoctorVisitInput } from '../../../../src/features/doctorVisits/types';
import type { ThemeColors } from '../../../../src/theme/types';

export default function NeuerArztbesuchScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const [saveError, setSaveError] = useState<string | null>(null);

  async function handleSubmit(input: DoctorVisitInput) {
    try {
      const db = await createEncryptedDb();
      await createDoctorVisit(db, input);
      setSaveError(null);
      router.back();
    } catch (error: unknown) {
      console.error('[Arztbesuche] Anlegen fehlgeschlagen:', error);
      setSaveError('Arztbesuch konnte nicht gespeichert werden.');
    }
  }

  return (
    <View style={styles.container}>
      {saveError && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{saveError}</Text>
        </View>
      )}
      <DoctorVisitForm onSubmit={handleSubmit} submitLabel="Arztbesuch speichern" />
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
  });
}
