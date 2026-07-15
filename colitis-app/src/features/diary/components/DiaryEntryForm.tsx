import { useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View, StyleSheet } from 'react-native';
import { NumberStepper } from '../../../components/ui/NumberStepper';
import { tokens } from '../../../styles/tokens';
import { SYMPTOM_OPTIONS, STOOL_CONSISTENCY_OPTIONS, TRIGGER_CATEGORY_OPTIONS } from '../constants';
import type { StoolConsistency, SymptomKey, TriggerCategory } from '../constants';
import {
  INITIAL_DIARY_ENTRY_FORM_STATE,
  buildDiaryEntryInput,
  toggleListValue,
  validateDiaryEntryForm,
  type DiaryEntryFormState,
} from '../formLogic';
import type { NewDiaryEntryInput } from '../types';

interface DiaryEntryFormProps {
  onSubmit: (input: NewDiaryEntryInput) => void | Promise<void>;
}

export function DiaryEntryForm({ onSubmit }: DiaryEntryFormProps) {
  const [formState, setFormState] = useState<DiaryEntryFormState>(INITIAL_DIARY_ENTRY_FORM_STATE);
  const [errors, setErrors] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit() {
    const validationErrors = validateDiaryEntryForm(formState);
    if (validationErrors.length > 0) {
      setErrors(validationErrors);
      return;
    }
    setErrors([]);
    setIsSubmitting(true);
    try {
      await Promise.resolve(onSubmit(buildDiaryEntryInput(formState, new Date().toISOString())));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <NumberStepper
        label="Stuhlgang-Häufigkeit heute"
        value={formState.stoolFrequency}
        onChange={(next) => setFormState({ ...formState, stoolFrequency: next })}
        min={0}
        max={20}
      />

      <Text style={styles.sectionLabel}>Blut im Stuhl</Text>
      <View style={styles.row}>
        {[
          { key: false, label: 'Nein' },
          { key: true, label: 'Ja' },
        ].map((option) => {
          const isSelected = formState.hasBlood === option.key;
          return (
            <Pressable
              key={String(option.key)}
              accessibilityRole="button"
              accessibilityState={{ selected: isSelected }}
              onPress={() => setFormState({ ...formState, hasBlood: option.key })}
              style={[
                styles.choiceButton,
                isSelected && (option.key ? styles.choiceButtonDanger : styles.choiceButtonActive),
              ]}
            >
              <Text style={styles.choiceButtonText}>{option.label}</Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={styles.sectionLabel}>Stuhlgang-Konsistenz</Text>
      <View style={styles.row}>
        {STOOL_CONSISTENCY_OPTIONS.map((option) => {
          const isSelected = formState.stoolConsistency === option.key;
          return (
            <Pressable
              key={option.key}
              accessibilityRole="button"
              accessibilityState={{ selected: isSelected }}
              onPress={() => setFormState({ ...formState, stoolConsistency: option.key as StoolConsistency })}
              style={[styles.choiceButton, isSelected && styles.choiceButtonActive]}
            >
              <Text style={styles.choiceButtonText}>{option.label}</Text>
            </Pressable>
          );
        })}
      </View>

      <NumberStepper
        label="Schmerzlevel (0-10)"
        value={formState.painLevel}
        onChange={(next) => setFormState({ ...formState, painLevel: next })}
        min={0}
        max={10}
      />

      <Text style={styles.sectionLabel}>Symptome</Text>
      <View style={styles.row}>
        {SYMPTOM_OPTIONS.map((option) => {
          const isSelected = formState.symptoms.includes(option.key as SymptomKey);
          return (
            <Pressable
              key={option.key}
              accessibilityRole="button"
              accessibilityState={{ selected: isSelected }}
              onPress={() =>
                setFormState({
                  ...formState,
                  symptoms: toggleListValue(formState.symptoms, option.key as SymptomKey),
                })
              }
              style={[styles.choiceButton, isSelected && styles.choiceButtonActive]}
            >
              <Text style={styles.choiceButtonText}>{option.label}</Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={styles.sectionLabel}>Mögliche Auslöser</Text>
      <View style={styles.row}>
        {TRIGGER_CATEGORY_OPTIONS.map((option) => {
          const isSelected = formState.triggerCategories.includes(option.key as TriggerCategory);
          return (
            <Pressable
              key={option.key}
              accessibilityRole="button"
              accessibilityState={{ selected: isSelected }}
              onPress={() =>
                setFormState({
                  ...formState,
                  triggerCategories: toggleListValue(formState.triggerCategories, option.key as TriggerCategory),
                })
              }
              style={[styles.choiceButton, isSelected && styles.choiceButtonActive]}
            >
              <Text style={styles.choiceButtonText}>{option.label}</Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={styles.sectionLabel}>Notiz</Text>
      <TextInput
        style={styles.noteInput}
        multiline
        placeholder="Zusätzliche Beobachtungen …"
        placeholderTextColor={tokens.colors.textSecondary}
        value={formState.note}
        onChangeText={(text) => setFormState({ ...formState, note: text })}
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
        <Text style={styles.submitButtonText}>Eintrag speichern</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: tokens.colors.background,
  },
  content: {
    padding: tokens.spacing.lg,
  },
  sectionLabel: {
    color: tokens.colors.textPrimary,
    fontSize: tokens.typography.fontSize.md,
    fontWeight: tokens.typography.fontWeight.medium,
    marginBottom: tokens.spacing.xs,
    marginTop: tokens.spacing.sm,
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: tokens.spacing.xs,
    marginBottom: tokens.spacing.md,
  },
  choiceButton: {
    paddingVertical: tokens.spacing.xs,
    paddingHorizontal: tokens.spacing.md,
    borderRadius: tokens.radius.pill,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    backgroundColor: tokens.colors.surface,
  },
  choiceButtonActive: {
    backgroundColor: tokens.colors.primary,
    borderColor: tokens.colors.primary,
  },
  choiceButtonDanger: {
    backgroundColor: tokens.colors.danger,
    borderColor: tokens.colors.danger,
  },
  choiceButtonText: {
    color: tokens.colors.textPrimary,
    fontSize: tokens.typography.fontSize.sm,
  },
  noteInput: {
    minHeight: 80,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    borderRadius: 8,
    padding: tokens.spacing.sm,
    color: tokens.colors.textPrimary,
    backgroundColor: tokens.colors.surface,
    textAlignVertical: 'top',
    marginBottom: tokens.spacing.lg,
  },
  errorBox: {
    backgroundColor: tokens.colors.surface,
    borderColor: tokens.colors.danger,
    borderWidth: 1,
    borderRadius: 8,
    padding: tokens.spacing.sm,
    marginBottom: tokens.spacing.md,
  },
  errorText: {
    color: tokens.colors.danger,
    fontSize: tokens.typography.fontSize.sm,
  },
  submitButton: {
    backgroundColor: tokens.colors.accent,
    borderRadius: 8,
    paddingVertical: tokens.spacing.md,
    alignItems: 'center',
  },
  submitButtonDisabled: {
    backgroundColor: tokens.colors.border,
  },
  submitButtonText: {
    color: tokens.colors.surface,
    fontSize: tokens.typography.fontSize.md,
    fontWeight: tokens.typography.fontWeight.bold,
  },
});
