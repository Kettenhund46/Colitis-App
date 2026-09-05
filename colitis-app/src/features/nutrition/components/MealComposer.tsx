import { Pressable, Text, TextInput, View, StyleSheet } from 'react-native';
import { isValidMealText, isValidMealTime, MAX_MEAL_LENGTH, MEALS_HINT } from '../meals';
import { isValidCalendarDate } from '../../medications/dateValidation';
import { useTheme } from '../../../theme/ThemeContext';
import { tokens } from '../../../styles/tokens';
import type { ThemeColors } from '../../../theme/types';

interface MealComposerProps {
  description: string;
  onDescriptionChange: (value: string) => void;
  /** Lokales Datum, JJJJ-MM-TT. */
  date: string;
  onDateChange: (value: string) => void;
  /** Lokale Uhrzeit, HH:mm. */
  time: string;
  onTimeChange: (value: string) => void;
  onSubmit: () => void;
}

export function isComposerReady(description: string, date: string, time: string): boolean {
  return isValidMealText(description) && isValidCalendarDate(date) && isValidMealTime(time);
}

export function MealComposer({
  description,
  onDescriptionChange,
  date,
  onDateChange,
  time,
  onTimeChange,
  onSubmit,
}: MealComposerProps) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const isReady = isComposerReady(description, date, time);

  return (
    <View style={styles.composer}>
      <Text style={styles.hint}>{MEALS_HINT}</Text>

      <TextInput
        style={styles.input}
        placeholder="z. B. Brot mit Käse, Kaffee"
        placeholderTextColor={colors.textSecondary}
        value={description}
        onChangeText={onDescriptionChange}
        multiline
        maxLength={MAX_MEAL_LENGTH}
        accessibilityLabel="Was hast du gegessen?"
      />

      {/* Datum und Uhrzeit sind mit dem Jetzt vorbelegt: Wer gleich eintraegt,
          fasst sie nie an. Wer abends nachtraegt, kann es. */}
      <View style={styles.whenRow}>
        <View style={styles.whenField}>
          <Text style={styles.fieldLabel}>Datum (JJJJ-MM-TT)</Text>
          <TextInput
            style={styles.input}
            value={date}
            onChangeText={onDateChange}
            accessibilityLabel="Datum der Mahlzeit"
          />
        </View>
        <View style={styles.whenField}>
          <Text style={styles.fieldLabel}>Uhrzeit (HH:mm)</Text>
          <TextInput
            style={styles.input}
            value={time}
            onChangeText={onTimeChange}
            accessibilityLabel="Uhrzeit der Mahlzeit"
          />
        </View>
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Mahlzeit eintragen"
        accessibilityState={{ disabled: !isReady }}
        disabled={!isReady}
        style={[styles.addButton, !isReady && styles.addButtonDisabled]}
        onPress={onSubmit}
      >
        <Text style={styles.addButtonText}>Mahlzeit eintragen</Text>
      </Pressable>
    </View>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    composer: {
      padding: tokens.spacing.lg,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      gap: tokens.spacing.sm,
    },
    hint: { color: colors.textSecondary, fontSize: tokens.typography.fontSize.sm, lineHeight: 20 },
    fieldLabel: {
      color: colors.textSecondary,
      fontSize: tokens.typography.fontSize.sm,
      marginBottom: tokens.spacing.xs,
    },
    whenRow: { flexDirection: 'row', gap: tokens.spacing.sm },
    whenField: { flex: 1 },
    input: {
      backgroundColor: colors.surface,
      borderRadius: tokens.radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      color: colors.textPrimary,
      fontSize: tokens.typography.fontSize.md,
      padding: tokens.spacing.md,
    },
    addButton: {
      backgroundColor: colors.primary,
      borderRadius: tokens.radius.md,
      paddingVertical: tokens.spacing.md,
      alignItems: 'center',
    },
    addButtonDisabled: { opacity: 0.5 },
    addButtonText: {
      color: colors.surface,
      fontSize: tokens.typography.fontSize.md,
      fontWeight: tokens.typography.fontWeight.medium,
    },
  });
}
