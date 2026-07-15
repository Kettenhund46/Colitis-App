import { useState } from 'react';
import { Pressable, Text, TextInput, View, StyleSheet } from 'react-native';
import { tokens } from '../../../styles/tokens';

const MIN_PASSWORD_LENGTH = 8;

interface BackupPasswordFormProps {
  requireConfirmation: boolean;
  submitLabel: string;
  onSubmit: (password: string) => void | Promise<void>;
  onCancel: () => void;
}

export function BackupPasswordForm({ requireConfirmation, submitLabel, onSubmit, onCancel }: BackupPasswordFormProps) {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit() {
    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`Das Passwort muss mindestens ${MIN_PASSWORD_LENGTH} Zeichen lang sein.`);
      return;
    }
    if (requireConfirmation && password !== confirmPassword) {
      setError('Die beiden Passwörter stimmen nicht überein.');
      return;
    }
    setError(null);
    setIsSubmitting(true);
    try {
      await Promise.resolve(onSubmit(password));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Backup-Passwort</Text>
      <TextInput
        style={styles.textInput}
        placeholderTextColor={tokens.colors.textSecondary}
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />
      {requireConfirmation && (
        <>
          <Text style={styles.label}>Passwort bestätigen</Text>
          <TextInput
            style={styles.textInput}
            placeholderTextColor={tokens.colors.textSecondary}
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry
          />
        </>
      )}
      {error && <Text style={styles.error}>{error}</Text>}
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: tokens.spacing.md,
    backgroundColor: tokens.colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: tokens.colors.border,
  },
  label: {
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
    backgroundColor: tokens.colors.background,
    marginBottom: tokens.spacing.sm,
  },
  error: {
    color: tokens.colors.danger,
    fontSize: tokens.typography.fontSize.sm,
    marginBottom: tokens.spacing.sm,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: tokens.spacing.sm,
    marginTop: tokens.spacing.sm,
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
