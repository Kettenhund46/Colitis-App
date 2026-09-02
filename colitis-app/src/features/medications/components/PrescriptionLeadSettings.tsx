import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { Text, View, StyleSheet } from 'react-native';
import { NumberStepper } from '../../../components/ui/NumberStepper';
import { SectionHeading } from '../../../components/ui/SectionHeading';
import { useTheme } from '../../../theme/ThemeContext';
import { tokens } from '../../../styles/tokens';
import { saveFeedback } from '../../../lib/haptics';
import {
  getPrescriptionLeadDays,
  setPrescriptionLeadDays,
} from '../../settings/settingsStorage';
import { DEFAULT_PRESCRIPTION_LEAD_DAYS, MAX_PRESCRIPTION_LEAD_DAYS } from '../supply';
import { formatDayCount } from '../../../lib/counting';
import type { ThemeColors } from '../../../theme/types';

interface PrescriptionLeadSettingsProps {
  /** Aendert sich der Wert, wird erneut gelesen. Siehe DiaryReminderSettings. */
  reloadKey?: number;
}

export function PrescriptionLeadSettings({ reloadKey = 0 }: PrescriptionLeadSettingsProps) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const [leadDays, setLeadDays] = useState(DEFAULT_PRESCRIPTION_LEAD_DAYS);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let isActive = true;

      getPrescriptionLeadDays()
        .then((days) => {
          if (isActive) {
            setLeadDays(days);
          }
        })
        .catch((loadError: unknown) => {
          console.error('[Medikamente] Rezept-Vorlauf konnte nicht gelesen werden:', loadError);
        });

      return () => {
        isActive = false;
        setError(null);
      };
    }, [reloadKey])
  );

  // Anders als beim Normalwert wird sofort gespeichert: Es gibt keinen
  // Zustand "nicht angegeben", jeder Wert ist gueltig.
  async function handleChange(next: number) {
    setLeadDays(next);
    try {
      await setPrescriptionLeadDays(next);
      setError(null);
      saveFeedback();
    } catch (saveError: unknown) {
      console.error('[Medikamente] Rezept-Vorlauf konnte nicht gespeichert werden:', saveError);
      setError('Der Wert konnte nicht gespeichert werden.');
    }
  }

  return (
    <View style={styles.container}>
      <SectionHeading>Rezept-Erinnerung</SectionHeading>
      <Text style={styles.hint}>
        Wie viele Tage vor dem Aufbrauchen soll die App an ein neues Rezept erinnern? Gilt für alle Medikamente,
        bei denen du einen Vorrat hinterlegt hast.
      </Text>

      {error && <Text style={styles.errorText}>{error}</Text>}

      <NumberStepper
        label="Vorlauf in Tagen"
        value={leadDays}
        onChange={(next) => void handleChange(next)}
        min={0}
        max={MAX_PRESCRIPTION_LEAD_DAYS}
      />

      <Text style={styles.state}>Erinnerung {formatDayCount(leadDays)} vorher.</Text>
    </View>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: { marginBottom: tokens.spacing.sm },
    hint: {
      color: colors.textSecondary,
      fontSize: tokens.typography.fontSize.sm,
      marginBottom: tokens.spacing.sm,
    },
    state: {
      color: colors.textSecondary,
      fontSize: tokens.typography.fontSize.sm,
      marginTop: tokens.spacing.sm,
    },
    errorText: {
      color: colors.danger,
      fontSize: tokens.typography.fontSize.sm,
      marginBottom: tokens.spacing.sm,
    },
  });
}
