import { useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View, StyleSheet } from 'react-native';
import { useTheme } from '../../../theme/ThemeContext';
import { tokens } from '../../../styles/tokens';
import {
  INITIAL_MEDICATION_FORM_STATE,
  addReminderTime,
  removeReminderTime,
  buildMedicationInput,
  validateMedicationForm,
  type MedicationFormState,
} from '../formLogic';
import type { MedicationInput } from '../types';
import type { ThemeColors } from '../../../theme/types';

interface MedicationFormProps {
  initialState?: MedicationFormState;
  onSubmit: (input: MedicationInput) => void | Promise<void>;
  submitLabel: string;
}

export function MedicationForm({ initialState, onSubmit, submitLabel }: MedicationFormProps) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const [formState, setFormState] = useState<MedicationFormState>(initialState ?? INITIAL_MEDICATION_FORM_STATE);
  const [newReminderTime, setNewReminderTime] = useState('');
  const [errors, setErrors] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  function handleAddReminderTime() {
    const trimmed = newReminderTime.trim();
    if (trimmed.length === 0) {
      return;
    }
    setFormState({ ...formState, reminderTimes: addReminderTime(formState.reminderTimes, trimmed) });
    setNewReminderTime('');
  }

  async function handleSubmit() {
    const validationErrors = validateMedicationForm(formState);
    if (validationErrors.length > 0) {
      setErrors(validationErrors);
      return;
    }
    setErrors([]);
    setIsSubmitting(true);
    try {
      await Promise.resolve(onSubmit(buildMedicationInput(formState)));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.sectionLabel}>Name</Text>
      <TextInput
        style={styles.textInput}
        placeholder="z. B. Salofalk"
        placeholderTextColor={colors.textSecondary}
        value={formState.name}
        onChangeText={(text) => setFormState({ ...formState, name: text })}
      />

      <Text style={styles.sectionLabel}>Dosis</Text>
      <TextInput
        style={styles.textInput}
        placeholder="z. B. 500mg"
        placeholderTextColor={colors.textSecondary}
        value={formState.dose}
        onChangeText={(text) => setFormState({ ...formState, dose: text })}
      />

      <Text style={styles.sectionLabel}>Einnahmeschema</Text>
      <TextInput
        style={styles.textInput}
        placeholder="z. B. 1x täglich morgens"
        placeholderTextColor={colors.textSecondary}
        value={formState.schedule}
        onChangeText={(text) => setFormState({ ...formState, schedule: text })}
      />

      <Text style={styles.sectionLabel}>Startdatum (JJJJ-MM-TT)</Text>
      <TextInput
        style={styles.textInput}
        placeholder="2026-07-12"
        placeholderTextColor={colors.textSecondary}
        value={formState.startDate}
        onChangeText={(text) => setFormState({ ...formState, startDate: text })}
      />

      <Text style={styles.sectionLabel}>Enddatum (optional, JJJJ-MM-TT)</Text>
      <TextInput
        style={styles.textInput}
        placeholder="Leer lassen, falls noch aktiv"
        placeholderTextColor={colors.textSecondary}
        value={formState.endDate}
        onChangeText={(text) => setFormState({ ...formState, endDate: text })}
      />

      <Text style={styles.sectionLabel}>Erinnerungszeiten</Text>
      <Text style={styles.hintText}>
        Für Erinnerungen wird beim Speichern die Benachrichtigungserlaubnis angefragt. Bei Ablehnung werden die
        Zeiten trotzdem gespeichert, aber ohne Push-Erinnerung.
      </Text>
      {formState.reminderTimes.map((time, index) => (
        <View key={`${time}-${index}`} style={styles.reminderRow}>
          <Text style={styles.reminderTimeText}>{time}</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Erinnerungszeit ${time} entfernen`}
            onPress={() =>
              setFormState({ ...formState, reminderTimes: removeReminderTime(formState.reminderTimes, index) })
            }
            style={styles.removeButton}
          >
            <Text style={styles.removeButtonText}>Entfernen</Text>
          </Pressable>
        </View>
      ))}
      <View style={styles.reminderRow}>
        <TextInput
          style={[styles.textInput, styles.reminderInput]}
          placeholder="HH:mm, z. B. 08:00"
          placeholderTextColor={colors.textSecondary}
          value={newReminderTime}
          onChangeText={setNewReminderTime}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Erinnerungszeit hinzufügen"
          onPress={handleAddReminderTime}
          style={styles.addTimeButton}
        >
          <Text style={styles.addTimeButtonText}>Hinzufügen</Text>
        </Pressable>
      </View>

      <Text style={styles.sectionLabel}>Nebenwirkungen (optional)</Text>
      <TextInput
        style={[styles.textInput, styles.noteInput]}
        placeholder="z. B. Verursacht gelegentlich Übelkeit"
        placeholderTextColor={colors.textSecondary}
        value={formState.sideEffectsNote}
        onChangeText={(text) => setFormState({ ...formState, sideEffectsNote: text })}
        multiline
      />

      {errors.length > 0 && (
        <View style={styles.errorBox}>
          {errors.map((error) => (
            <Text key={error} style={styles.errorText}>
              {error}
            </Text>
          ))}
        </View>
      )}

      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled: isSubmitting }}
        disabled={isSubmitting}
        style={[styles.submitButton, isSubmitting && styles.submitButtonDisabled]}
        onPress={handleSubmit}
      >
        <Text style={styles.submitButtonText}>{submitLabel}</Text>
      </Pressable>
    </ScrollView>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    content: { padding: tokens.spacing.lg },
    sectionLabel: {
      color: colors.textPrimary,
      fontSize: tokens.typography.fontSize.md,
      fontWeight: tokens.typography.fontWeight.medium,
      marginBottom: tokens.spacing.xs,
      marginTop: tokens.spacing.sm,
    },
    hintText: {
      color: colors.textSecondary,
      fontSize: tokens.typography.fontSize.sm,
      marginBottom: tokens.spacing.sm,
    },
    textInput: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 8,
      padding: tokens.spacing.sm,
      color: colors.textPrimary,
      backgroundColor: colors.surface,
      marginBottom: tokens.spacing.md,
    },
    reminderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: tokens.spacing.sm,
      marginBottom: tokens.spacing.sm,
    },
    reminderTimeText: {
      color: colors.textPrimary,
      fontSize: tokens.typography.fontSize.md,
      flex: 1,
    },
    reminderInput: {
      flex: 1,
      marginBottom: 0,
    },
    noteInput: {
      minHeight: 72,
      textAlignVertical: 'top',
    },
    removeButton: {
      paddingVertical: tokens.spacing.xs,
      paddingHorizontal: tokens.spacing.md,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.danger,
    },
    removeButtonText: { color: colors.danger, fontSize: tokens.typography.fontSize.sm },
    addTimeButton: {
      paddingVertical: tokens.spacing.xs,
      paddingHorizontal: tokens.spacing.md,
      borderRadius: 8,
      backgroundColor: colors.primary,
    },
    addTimeButtonText: { color: colors.surface, fontSize: tokens.typography.fontSize.sm },
    errorBox: {
      backgroundColor: colors.surface,
      borderColor: colors.danger,
      borderWidth: 1,
      borderRadius: 8,
      padding: tokens.spacing.sm,
      marginBottom: tokens.spacing.md,
    },
    errorText: { color: colors.danger, fontSize: tokens.typography.fontSize.sm },
    submitButton: {
      backgroundColor: colors.accent,
      borderRadius: 8,
      paddingVertical: tokens.spacing.md,
      alignItems: 'center',
      marginTop: tokens.spacing.md,
    },
    submitButtonDisabled: { backgroundColor: colors.border },
    submitButtonText: {
      color: colors.surface,
      fontSize: tokens.typography.fontSize.md,
      fontWeight: tokens.typography.fontWeight.bold,
    },
  });
}
