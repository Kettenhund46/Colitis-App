import { useState } from 'react';
import { Pressable, Text, TextInput, View, StyleSheet } from 'react-native';
import { tokens } from '../../../styles/tokens';
import { isValidCalendarDate } from '../dateValidation';
import type { ScreeningReminder, NewScreeningReminderInput } from '../types';

interface ScreeningReminderCardProps {
  reminder: ScreeningReminder | null;
  onSave: (input: NewScreeningReminderInput) => void | Promise<void>;
}

export function ScreeningReminderCard({ reminder, onSave }: ScreeningReminderCardProps) {
  const [intervalMonths, setIntervalMonths] = useState(reminder ? String(reminder.intervalMonths) : '');
  const [nextDueDate, setNextDueDate] = useState(reminder?.nextDueDate ?? '');
  const [note, setNote] = useState(reminder?.note ?? '');
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  async function handleSave() {
    const parsedInterval = Number(intervalMonths);
    if (!Number.isInteger(parsedInterval) || parsedInterval <= 0) {
      setError('Bitte ein gültiges Intervall in Monaten eingeben (ganze Zahl größer 0).');
      return;
    }
    if (!isValidCalendarDate(nextDueDate)) {
      setError('Bitte ein gültiges Datum eingeben (JJJJ-MM-TT).');
      return;
    }
    setError(null);
    setIsSaving(true);
    try {
      await Promise.resolve(
        onSave({
          intervalMonths: parsedInterval,
          nextDueDate,
          note: note.trim().length > 0 ? note.trim() : null,
        })
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Vorsorge-Koloskopie</Text>
      <Text style={styles.hintText}>
        Für die Erinnerung wird beim Speichern die Benachrichtigungserlaubnis angefragt. Bei Ablehnung wird der
        Termin trotzdem gespeichert, aber ohne Push-Erinnerung.
      </Text>
      <Text style={styles.label}>Intervall (Monate)</Text>
      <TextInput
        style={styles.textInput}
        keyboardType="number-pad"
        placeholder="z. B. 12"
        placeholderTextColor={tokens.colors.textSecondary}
        value={intervalMonths}
        onChangeText={setIntervalMonths}
      />
      <Text style={styles.label}>Nächstes fälliges Datum (JJJJ-MM-TT)</Text>
      <TextInput
        style={styles.textInput}
        placeholder="2027-01-15"
        placeholderTextColor={tokens.colors.textSecondary}
        value={nextDueDate}
        onChangeText={setNextDueDate}
      />
      <Text style={styles.label}>Notiz (optional)</Text>
      <TextInput
        style={styles.textInput}
        placeholder="z. B. Rücksprache mit Dr. …"
        placeholderTextColor={tokens.colors.textSecondary}
        value={note}
        onChangeText={setNote}
      />
      {error && <Text style={styles.errorText}>{error}</Text>}
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled: isSaving }}
        disabled={isSaving}
        style={[styles.saveButton, isSaving && styles.saveButtonDisabled]}
        onPress={handleSave}
      >
        <Text style={styles.saveButtonText}>Speichern</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: tokens.colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    padding: tokens.spacing.md,
    margin: tokens.spacing.lg,
    marginBottom: 0,
  },
  title: {
    color: tokens.colors.textPrimary,
    fontSize: tokens.typography.fontSize.md,
    fontWeight: tokens.typography.fontWeight.bold,
    marginBottom: tokens.spacing.xs,
  },
  hintText: {
    color: tokens.colors.textSecondary,
    fontSize: tokens.typography.fontSize.sm,
    marginBottom: tokens.spacing.sm,
  },
  label: { color: tokens.colors.textPrimary, fontSize: tokens.typography.fontSize.sm, marginBottom: tokens.spacing.xs },
  textInput: {
    borderWidth: 1,
    borderColor: tokens.colors.border,
    borderRadius: 8,
    padding: tokens.spacing.sm,
    color: tokens.colors.textPrimary,
    backgroundColor: tokens.colors.background,
    marginBottom: tokens.spacing.sm,
  },
  errorText: { color: tokens.colors.danger, fontSize: tokens.typography.fontSize.sm, marginBottom: tokens.spacing.sm },
  saveButton: {
    backgroundColor: tokens.colors.accent,
    borderRadius: 8,
    paddingVertical: tokens.spacing.sm,
    alignItems: 'center',
  },
  saveButtonDisabled: { backgroundColor: tokens.colors.border },
  saveButtonText: {
    color: tokens.colors.surface,
    fontSize: tokens.typography.fontSize.md,
    fontWeight: tokens.typography.fontWeight.bold,
  },
});
