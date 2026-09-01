import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { Pressable, Text, View, StyleSheet } from 'react-native';
import { NumberStepper } from '../../../components/ui/NumberStepper';
import { SectionHeading } from '../../../components/ui/SectionHeading';
import { useTheme } from '../../../theme/ThemeContext';
import { tokens } from '../../../styles/tokens';
import { saveFeedback } from '../../../lib/haptics';
import {
  getNormalStoolFrequency,
  setNormalStoolFrequency,
  MAX_NORMAL_STOOL_FREQUENCY,
} from '../../settings/settingsStorage';
import { formatNormalStoolsLabel, ACTIVITY_INDEX_ORIGIN_NOTE } from '../activityIndex';
import type { ThemeColors } from '../../../theme/types';

/** Vorschlag im noch nicht beantworteten Zustand -- die haeufigste Angabe. */
const SUGGESTED_NORMAL = 1;

interface NormalStoolFrequencySettingsProps {
  /** Aendert sich der Wert, wird erneut gelesen. Siehe DiaryReminderSettings. */
  reloadKey?: number;
}

export function NormalStoolFrequencySettings({ reloadKey = 0 }: NormalStoolFrequencySettingsProps) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const [storedValue, setStoredValue] = useState<number | null>(null);
  const [draft, setDraft] = useState(SUGGESTED_NORMAL);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let isActive = true;

      getNormalStoolFrequency()
        .then((value) => {
          if (isActive) {
            setStoredValue(value);
            setDraft(value ?? SUGGESTED_NORMAL);
          }
        })
        .catch((loadError: unknown) => {
          console.error('[Tagebuch] Normalwert konnte nicht gelesen werden:', loadError);
        });

      return () => {
        isActive = false;
        setError(null);
      };
    }, [reloadKey])
  );

  async function persist(value: number | null) {
    try {
      await setNormalStoolFrequency(value);
      setStoredValue(value);
      setError(null);
      saveFeedback();
    } catch (saveError: unknown) {
      console.error('[Tagebuch] Normalwert konnte nicht gespeichert werden:', saveError);
      setError('Der Wert konnte nicht gespeichert werden.');
    }
  }

  const isSet = storedValue !== null;

  return (
    <View style={styles.container}>
      <SectionHeading>Krankheitsaktivität</SectionHeading>
      <Text style={styles.hint}>
        Wie viele Stuhlgänge hast du an einem gewöhnlichen Tag, außerhalb eines Schubs? Der Mayo-Score zählt die
        Frequenz relativ zu diesem Wert — ohne ihn lässt sich die Aktivität nicht berechnen.
      </Text>

      {error && <Text style={styles.errorText}>{error}</Text>}

      <NumberStepper
        label="Üblich pro Tag"
        value={draft}
        onChange={setDraft}
        min={0}
        max={MAX_NORMAL_STOOL_FREQUENCY}
      />

      <View style={styles.actionsRow}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Normalwert speichern"
          accessibilityState={{ disabled: storedValue === draft }}
          disabled={storedValue === draft}
          style={[styles.saveButton, storedValue === draft && styles.saveButtonDisabled]}
          onPress={() => void persist(draft)}
        >
          <Text style={styles.saveButtonText}>{isSet ? 'Ändern' : 'Speichern'}</Text>
        </Pressable>
        {isSet && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Normalwert entfernen"
            style={styles.clearButton}
            onPress={() => void persist(null)}
          >
            <Text style={styles.clearButtonText}>Entfernen</Text>
          </Pressable>
        )}
      </View>

      <Text style={styles.state}>
        {isSet ? formatNormalStoolsLabel(storedValue) : 'Noch nicht angegeben — die Aktivität bleibt leer.'}
      </Text>
      <Text style={styles.originNote}>{ACTIVITY_INDEX_ORIGIN_NOTE}</Text>
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
    actionsRow: {
      flexDirection: 'row',
      gap: tokens.spacing.sm,
      marginTop: tokens.spacing.xs,
    },
    saveButton: {
      backgroundColor: colors.accent,
      borderRadius: tokens.radius.sm,
      paddingVertical: tokens.spacing.xs,
      paddingHorizontal: tokens.spacing.md,
    },
    saveButtonDisabled: { backgroundColor: colors.border },
    saveButtonText: {
      color: colors.surface,
      fontSize: tokens.typography.fontSize.sm,
      fontWeight: tokens.typography.fontWeight.medium,
    },
    clearButton: {
      borderRadius: tokens.radius.sm,
      borderWidth: 1,
      borderColor: colors.border,
      paddingVertical: tokens.spacing.xs,
      paddingHorizontal: tokens.spacing.md,
    },
    clearButtonText: { color: colors.textPrimary, fontSize: tokens.typography.fontSize.sm },
    state: {
      color: colors.textSecondary,
      fontSize: tokens.typography.fontSize.sm,
      marginTop: tokens.spacing.sm,
    },
    originNote: {
      color: colors.textSecondary,
      fontSize: tokens.typography.fontSize.sm,
      fontStyle: 'italic',
      marginTop: tokens.spacing.xs,
    },
    errorText: {
      color: colors.danger,
      fontSize: tokens.typography.fontSize.sm,
      marginBottom: tokens.spacing.sm,
    },
  });
}
