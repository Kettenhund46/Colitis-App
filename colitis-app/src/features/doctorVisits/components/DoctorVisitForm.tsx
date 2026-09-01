import { useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View, StyleSheet } from 'react-native';
import { useTheme } from '../../../theme/ThemeContext';
import { tokens } from '../../../styles/tokens';
import {
  INITIAL_DOCTOR_VISIT_FORM_STATE,
  buildDoctorVisitInput,
  validateDoctorVisitForm,
  type DoctorVisitFormState,
} from '../formLogic';
import type { DoctorVisitInput } from '../types';
import type { ThemeColors } from '../../../theme/types';

interface DoctorVisitFormProps {
  initialState?: DoctorVisitFormState;
  onSubmit: (input: DoctorVisitInput) => void | Promise<void>;
  submitLabel: string;
}

export function DoctorVisitForm({ initialState, onSubmit, submitLabel }: DoctorVisitFormProps) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const [formState, setFormState] = useState<DoctorVisitFormState>(initialState ?? INITIAL_DOCTOR_VISIT_FORM_STATE);
  const [errors, setErrors] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit() {
    const validationErrors = validateDoctorVisitForm(formState);
    if (validationErrors.length > 0) {
      setErrors(validationErrors);
      return;
    }
    setErrors([]);
    setIsSubmitting(true);
    try {
      await Promise.resolve(onSubmit(buildDoctorVisitInput(formState)));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.sectionLabel}>Datum (JJJJ-MM-TT)</Text>
      <TextInput
        style={styles.textInput}
        placeholder="2026-07-20"
        placeholderTextColor={colors.textSecondary}
        value={formState.visitDate}
        onChangeText={(text) => setFormState({ ...formState, visitDate: text })}
      />

      <Text style={styles.sectionLabel}>Arzt/Fachrichtung (optional)</Text>
      <TextInput
        style={styles.textInput}
        placeholder="z. B. Dr. Müller, Gastroenterologie"
        placeholderTextColor={colors.textSecondary}
        value={formState.doctorName}
        onChangeText={(text) => setFormState({ ...formState, doctorName: text })}
      />

      <Text style={styles.sectionLabel}>Anlass/Grund (optional)</Text>
      <TextInput
        style={styles.textInput}
        placeholder="z. B. Kontrolle, akuter Schub"
        placeholderTextColor={colors.textSecondary}
        value={formState.reason}
        onChangeText={(text) => setFormState({ ...formState, reason: text })}
      />

      <Text style={styles.sectionLabel}>Notizen/Ergebnis (optional)</Text>
      <TextInput
        style={[styles.textInput, styles.noteInput]}
        placeholder="z. B. Befund, Besprochenes, Medikamentenänderungen"
        placeholderTextColor={colors.textSecondary}
        value={formState.note}
        onChangeText={(text) => setFormState({ ...formState, note: text })}
        multiline
      />

      <Text style={styles.sectionLabel}>Nächster Termin (optional, JJJJ-MM-TT)</Text>
      <Text style={styles.hintText}>
        Ist ein Termin eingetragen, erinnert dich die App am Vorabend um 18:00 Uhr. Dafür wird beim Speichern die
        Benachrichtigungserlaubnis angefragt; bei Ablehnung wird der Termin trotzdem gespeichert.
      </Text>
      <TextInput
        style={styles.textInput}
        placeholder="Leer lassen, falls noch kein Folgetermin bekannt"
        placeholderTextColor={colors.textSecondary}
        value={formState.nextAppointmentDate}
        onChangeText={(text) => setFormState({ ...formState, nextAppointmentDate: text })}
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
    noteInput: {
      minHeight: 72,
      textAlignVertical: 'top',
    },
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
