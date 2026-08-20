import { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { Text, TextInput, View, StyleSheet } from 'react-native';
import { SliderToggle } from '../../../components/SliderToggle';
import {
  getDiaryReminderEnabled,
  setDiaryReminderEnabled,
  getDiaryReminderTime,
  setDiaryReminderTime,
  DEFAULT_DIARY_REMINDER_TIME,
} from '../../settings/settingsStorage';
import { isValidReminderTime } from '../../medications/reminderScheduling';
import { rescheduleDiaryReminder } from '../scheduleDiaryReminder';
import { useTheme } from '../../../theme/ThemeContext';
import { tokens } from '../../../styles/tokens';
import type { DiaryReminderResult } from '../scheduleDiaryReminder';
import type { ThemeColors } from '../../../theme/types';

const ERROR_MESSAGES: Partial<Record<DiaryReminderResult, string>> = {
  'permission-denied': 'Ohne Benachrichtigungsberechtigung ist die Erinnerung nicht möglich.',
  'invalid-time': 'Bitte eine Uhrzeit im Format HH:MM angeben, zum Beispiel 20:00.',
  failed: 'Erinnerung konnte nicht eingerichtet werden.',
};

export function DiaryReminderSettings() {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const [isEnabled, setIsEnabled] = useState(false);
  const [timeText, setTimeText] = useState(DEFAULT_DIARY_REMINDER_TIME);
  const [error, setError] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  const isMountedRef = useRef(true);
  const isBusyRef = useRef(false);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useFocusEffect(
    useCallback(() => {
      let isActive = true;

      Promise.all([getDiaryReminderEnabled(), getDiaryReminderTime()])
        .then(([enabled, time]) => {
          if (isActive) {
            setIsEnabled(enabled);
            setTimeText(time);
          }
        })
        .catch((loadError: unknown) => {
          console.error('[Tagebuch] Erinnerungs-Einstellungen konnten nicht gelesen werden:', loadError);
        });

      return () => {
        isActive = false;
        setError(null);
      };
    }, [])
  );

  async function runReschedule(): Promise<void> {
    try {
      const result = await rescheduleDiaryReminder();

      if (result === 'permission-denied' || result === 'failed') {
        if (isMountedRef.current) {
          setIsEnabled(false);
          setError(ERROR_MESSAGES[result] ?? null);
        }
        return;
      }

      if (isMountedRef.current) {
        setError(result === 'invalid-time' ? ERROR_MESSAGES['invalid-time'] ?? null : null);
      }
    } catch (rescheduleError: unknown) {
      console.error('[Tagebuch] Erinnerung konnte nicht eingerichtet werden:', rescheduleError);
      try {
        await setDiaryReminderEnabled(false);
      } catch (resetError: unknown) {
        console.error('[Tagebuch] Einstellung konnte nicht zurueckgesetzt werden:', resetError);
      }
      if (isMountedRef.current) {
        setIsEnabled(false);
        setError('Erinnerung konnte nicht eingerichtet werden.');
      }
    }
  }

  async function handleToggle(value: boolean) {
    if (isBusyRef.current) {
      return;
    }
    isBusyRef.current = true;
    setIsBusy(true);
    setIsEnabled(value);

    try {
      await setDiaryReminderEnabled(value);
      await runReschedule();
    } catch (toggleError: unknown) {
      console.error('[Tagebuch] Erinnerung konnte nicht umgeschaltet werden:', toggleError);
      if (isMountedRef.current) {
        setIsEnabled(false);
        setError('Erinnerung konnte nicht eingerichtet werden.');
      }
    } finally {
      isBusyRef.current = false;
      if (isMountedRef.current) {
        setIsBusy(false);
      }
    }
  }

  async function handleCommitTime() {
    if (isBusyRef.current) {
      return;
    }
    isBusyRef.current = true;
    setIsBusy(true);

    try {
      const trimmed = timeText.trim();

      if (!isValidReminderTime(trimmed)) {
        const stored = await getDiaryReminderTime();
        if (isMountedRef.current) {
          setError('Bitte eine Uhrzeit im Format HH:MM angeben, zum Beispiel 20:00.');
          setTimeText(stored);
        }
        return;
      }

      await setDiaryReminderTime(trimmed);
      await runReschedule();
    } catch (timeError: unknown) {
      console.error('[Tagebuch] Erinnerungszeit konnte nicht gespeichert werden:', timeError);
      if (isMountedRef.current) {
        setError('Erinnerung konnte nicht eingerichtet werden.');
      }
    } finally {
      isBusyRef.current = false;
      if (isMountedRef.current) {
        setIsBusy(false);
      }
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Tägliche Erinnerung</Text>

      {error && <Text style={styles.errorText}>{error}</Text>}

      <View style={styles.row}>
        <Text style={styles.rowLabel}>Ans Eintragen erinnern</Text>
        <SliderToggle
          value={isEnabled}
          onValueChange={(value) => void handleToggle(value)}
          accessibilityLabel="Tägliche Erinnerung ans Eintragen"
          disabled={isBusy}
        />
      </View>

      {isEnabled && (
        <View style={styles.timeRow}>
          <Text style={styles.rowLabel}>Uhrzeit (HH:MM)</Text>
          <TextInput
            accessibilityLabel="Uhrzeit der täglichen Erinnerung"
            style={styles.timeInput}
            value={timeText}
            onChangeText={setTimeText}
            onEndEditing={() => void handleCommitTime()}
            keyboardType="numbers-and-punctuation"
            maxLength={5}
            placeholder="20:00"
            placeholderTextColor={colors.textSecondary}
            editable={!isBusy}
          />
        </View>
      )}

      <Text style={styles.hint}>
        Die Erinnerung kommt jeden Tag, auch wenn du schon etwas erfasst hast.
      </Text>
    </View>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      marginBottom: tokens.spacing.sm,
    },
    heading: {
      color: colors.textPrimary,
      fontSize: tokens.typography.fontSize.lg,
      fontWeight: tokens.typography.fontWeight.bold,
      marginTop: tokens.spacing.lg,
      marginBottom: tokens.spacing.sm,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: tokens.spacing.sm,
    },
    timeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: tokens.spacing.sm,
    },
    rowLabel: {
      color: colors.textPrimary,
      fontSize: tokens.typography.fontSize.md,
    },
    timeInput: {
      color: colors.textPrimary,
      fontSize: tokens.typography.fontSize.md,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: tokens.radius.sm,
      paddingHorizontal: tokens.spacing.md,
      paddingVertical: tokens.spacing.xs,
      minWidth: 88,
      textAlign: 'center',
    },
    hint: {
      color: colors.textSecondary,
      fontSize: tokens.typography.fontSize.sm,
      marginTop: tokens.spacing.xs,
    },
    errorText: {
      color: colors.danger,
      fontSize: tokens.typography.fontSize.sm,
      marginBottom: tokens.spacing.sm,
    },
  });
}
