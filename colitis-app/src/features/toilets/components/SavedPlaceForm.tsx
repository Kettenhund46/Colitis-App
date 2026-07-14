import { useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View, StyleSheet } from 'react-native';
import { tokens } from '../../../styles/tokens';
import {
  INITIAL_SAVED_PLACE_FORM_STATE,
  CATEGORY_SUGGESTIONS,
  validateSavedPlaceForm,
  buildSavedPlaceInput,
  type SavedPlaceFormState,
} from '../savedPlaceFormLogic';
import type { Coordinates, SavedPlaceInput } from '../types';

interface SavedPlaceFormProps {
  coordinates: Coordinates;
  initialState?: SavedPlaceFormState;
  onSubmit: (input: SavedPlaceInput) => void | Promise<void>;
  onCancel: () => void;
  submitLabel: string;
}

export function SavedPlaceForm({ coordinates, initialState, onSubmit, onCancel, submitLabel }: SavedPlaceFormProps) {
  const [formState, setFormState] = useState<SavedPlaceFormState>(initialState ?? INITIAL_SAVED_PLACE_FORM_STATE);
  const [errors, setErrors] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit() {
    const validationErrors = validateSavedPlaceForm(formState);
    if (validationErrors.length > 0) {
      setErrors(validationErrors);
      return;
    }
    setErrors([]);
    setIsSubmitting(true);
    try {
      await Promise.resolve(onSubmit(buildSavedPlaceInput(formState, coordinates)));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <View style={styles.overlay}>
      <ScrollView style={styles.card} contentContainerStyle={styles.content}>
        <Text style={styles.title}>Sicherer Ort</Text>

        <Text style={styles.sectionLabel}>Name</Text>
        <TextInput
          style={styles.textInput}
          placeholder="z. B. Büro"
          placeholderTextColor={tokens.colors.textSecondary}
          value={formState.name}
          onChangeText={(text) => setFormState({ ...formState, name: text })}
        />

        <Text style={styles.sectionLabel}>Kategorie</Text>
        <View style={styles.chipRow}>
          {CATEGORY_SUGGESTIONS.map((suggestion) => (
            <Pressable
              key={suggestion}
              accessibilityRole="button"
              accessibilityLabel={`Kategorie ${suggestion} wählen`}
              style={[styles.chip, formState.category === suggestion && styles.chipSelected]}
              onPress={() => setFormState({ ...formState, category: suggestion })}
            >
              <Text style={[styles.chipText, formState.category === suggestion && styles.chipTextSelected]}>
                {suggestion}
              </Text>
            </Pressable>
          ))}
        </View>
        <TextInput
          style={styles.textInput}
          placeholder="Eigene Kategorie"
          placeholderTextColor={tokens.colors.textSecondary}
          value={formState.category}
          onChangeText={(text) => setFormState({ ...formState, category: text })}
        />

        <Text style={styles.sectionLabel}>Notiz (optional)</Text>
        <TextInput
          style={[styles.textInput, styles.noteInput]}
          placeholder="z. B. Toilette im 2. Stock"
          placeholderTextColor={tokens.colors.textSecondary}
          value={formState.note}
          onChangeText={(text) => setFormState({ ...formState, note: text })}
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

        <View style={styles.buttonRow}>
          <Pressable accessibilityRole="button" accessibilityLabel="Abbrechen" style={styles.cancelButton} onPress={onCancel}>
            <Text style={styles.cancelButtonText}>Abbrechen</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ disabled: isSubmitting }}
            disabled={isSubmitting}
            style={[styles.submitButton, isSubmitting && styles.submitButtonDisabled]}
            onPress={handleSubmit}
          >
            <Text style={styles.submitButtonText}>{submitLabel}</Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    backgroundColor: tokens.colors.overlay,
    justifyContent: 'flex-end',
  },
  card: {
    maxHeight: '80%',
    backgroundColor: tokens.colors.surface,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  content: {
    padding: tokens.spacing.lg,
  },
  title: {
    color: tokens.colors.textPrimary,
    fontSize: tokens.typography.fontSize.lg,
    fontWeight: tokens.typography.fontWeight.bold,
    marginBottom: tokens.spacing.md,
  },
  sectionLabel: {
    color: tokens.colors.textPrimary,
    fontSize: tokens.typography.fontSize.md,
    fontWeight: tokens.typography.fontWeight.medium,
    marginBottom: tokens.spacing.xs,
    marginTop: tokens.spacing.sm,
  },
  textInput: {
    borderWidth: 1,
    borderColor: tokens.colors.border,
    borderRadius: 8,
    padding: tokens.spacing.sm,
    color: tokens.colors.textPrimary,
    backgroundColor: tokens.colors.surface,
    marginBottom: tokens.spacing.md,
  },
  noteInput: {
    minHeight: 72,
    textAlignVertical: 'top',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: tokens.spacing.xs,
    marginBottom: tokens.spacing.sm,
  },
  chip: {
    paddingVertical: tokens.spacing.xs,
    paddingHorizontal: tokens.spacing.md,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: tokens.colors.border,
  },
  chipSelected: {
    backgroundColor: tokens.colors.primary,
    borderColor: tokens.colors.primary,
  },
  chipText: {
    color: tokens.colors.textPrimary,
    fontSize: tokens.typography.fontSize.sm,
  },
  chipTextSelected: {
    color: tokens.colors.surface,
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
  buttonRow: {
    flexDirection: 'row',
    gap: tokens.spacing.sm,
    marginTop: tokens.spacing.md,
  },
  cancelButton: {
    flex: 1,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    paddingVertical: tokens.spacing.md,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: tokens.colors.textPrimary,
    fontSize: tokens.typography.fontSize.md,
  },
  submitButton: {
    flex: 1,
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
