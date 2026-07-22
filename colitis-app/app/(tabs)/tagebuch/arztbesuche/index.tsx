import { useCallback, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { Alert, Pressable, Text, View, StyleSheet } from 'react-native';
import { createEncryptedDb } from '../../../../src/db/client';
import { listDoctorVisits, deleteDoctorVisit } from '../../../../src/features/doctorVisits/db/doctorVisitsRepository';
import { exportDoctorVisitPass } from '../../../../src/features/doctorVisits/doctorVisitPassExport';
import { DoctorVisitList } from '../../../../src/features/doctorVisits/components/DoctorVisitList';
import { useTheme } from '../../../../src/theme/ThemeContext';
import { tokens } from '../../../../src/styles/tokens';
import type { DoctorVisit } from '../../../../src/features/doctorVisits/types';
import type { ThemeColors } from '../../../../src/theme/types';

export default function ArztbesucheScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const [visits, setVisits] = useState<DoctorVisit[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let isActive = true;
      setIsLoading(true);

      createEncryptedDb()
        .then((db) => listDoctorVisits(db))
        .then((loadedVisits) => {
          if (isActive) {
            setVisits(loadedVisits);
            setError(null);
            setIsLoading(false);
          }
        })
        .catch((loadError: unknown) => {
          console.error('[Arztbesuche] Laden fehlgeschlagen:', loadError);
          if (isActive) {
            setError('Arztbesuche konnten nicht geladen werden.');
            setIsLoading(false);
          }
        });

      return () => {
        isActive = false;
      };
    }, [])
  );

  function handleDelete(visitId: number) {
    Alert.alert('Arztbesuch löschen?', 'Dieser Arztbesuch wird endgültig gelöscht.', [
      { text: 'Abbrechen', style: 'cancel' },
      {
        text: 'Löschen',
        style: 'destructive',
        onPress: () => void confirmDelete(visitId),
      },
    ]);
  }

  async function confirmDelete(visitId: number) {
    try {
      const db = await createEncryptedDb();
      await deleteDoctorVisit(db, visitId);
      setVisits(await listDoctorVisits(db));
      setError(null);
    } catch (deleteError: unknown) {
      console.error('[Arztbesuche] Löschen fehlgeschlagen:', deleteError);
      setError('Arztbesuch konnte nicht gelöscht werden.');
    }
  }

  async function handleExportPass() {
    setIsExporting(true);
    try {
      await exportDoctorVisitPass(visits);
      setError(null);
    } catch (exportError: unknown) {
      console.error('[Arztbesuche] PDF-Export fehlgeschlagen:', exportError);
      setError('Arztbesuch-Übersicht konnte nicht exportiert werden.');
    } finally {
      setIsExporting(false);
    }
  }

  return (
    <View style={styles.container}>
      {error && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled: isExporting || visits.length === 0 }}
        accessibilityLabel="Arztbesuch-Übersicht als PDF exportieren"
        disabled={isExporting || visits.length === 0}
        style={[styles.exportLink, (isExporting || visits.length === 0) && styles.exportLinkDisabled]}
        onPress={handleExportPass}
      >
        <Text style={styles.exportLinkText}>
          {isExporting ? 'PDF wird erstellt …' : 'Arztbesuch-Übersicht als PDF exportieren'}
        </Text>
      </Pressable>
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Arztbesuche werden geladen …</Text>
        </View>
      ) : (
        <DoctorVisitList
          visits={visits}
          onEdit={(visitId) => router.push(`/tagebuch/arztbesuche/${visitId}`)}
          onDelete={handleDelete}
        />
      )}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Neuen Arztbesuch anlegen"
        style={styles.addButton}
        onPress={() => router.push('/tagebuch/arztbesuche/neu')}
      >
        <Text style={styles.addButtonText}>+</Text>
      </Pressable>
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
