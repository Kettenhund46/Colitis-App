import { useState } from 'react';
import { Alert, Pressable, Text, TextInput, View, StyleSheet } from 'react-native';
import { useTheme } from '../../../theme/ThemeContext';
import { tokens } from '../../../styles/tokens';
import { isValidCalendarDate } from '../dateValidation';
import type { ScreeningReminder, NewScreeningReminderInput } from '../types';
import type { ThemeColors } from '../../../theme/types';

interface ScreeningReminderCardProps {
  reminder: ScreeningReminder | null;
  onSave: (input: NewScreeningReminderInput) => void | Promise<void>;
  onDelete: () => void | Promise<void>;
}

export function ScreeningReminderCard({ reminder, onSave, onDelete }: ScreeningReminderCardProps) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const [isEditing, setIsEditing] = useState(reminder === null);
  const [intervalMonths, setIntervalMonths] = useState(reminder ? String(reminder.intervalMonths) : '');
  const [nextDueDate, setNextDueDate] = useState(reminder?.nextDueDate ?? '');
  const [note, setNote] = useState(reminder?.note ?? '');
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  function startEditing() {
    setIntervalMonths(reminder ? String(reminder.intervalMonths) : '');
    setNextDueDate(reminder?.nextDueDate ?? '');
    setNote(reminder?.note ?? '');
    setError(null);
    setIsEditing(true);
  }

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
      setIsEditing(false);
    } finally {
      setIsSaving(false);
    }
  }

  function handleDelete() {
    Alert.alert('Vorsorge-Termin löschen?', 'Der gespeicherte Koloskopie-Termin wird endgültig gelöscht.', [
      { text: 'Abbrechen', style: 'cancel' },
      {
        text: 'Löschen',
        style: 'destructive',
        onPress: () => void Promise.resolve(onDelete()).then(() => setIsEditing(true)),
      },
    ]);
  }

  if (reminder && !isEditing) {
    return (
      <View style={styles.card}>
        <Text style={styles.title}>Vorsorge-Koloskopie</Text>
        <Text style={styles.label}>Nächstes fälliges Datum</Text>
        <Text style={styles.viewValue}>{reminder.nextDueDate}</Text>
        <Text style={styles.label}>Intervall</Text>
        <Text style={styles.viewValue}>Alle {reminder.intervalMonths} Monate</Text>
        {reminder.note && (
          <>
            <Text style={styles.label}>Notiz</Text>
            <Text style={styles.viewValue}>{reminder.note}</Text>
          </>
        )}
        <View style={styles.actionsRow}>
          <Pressable accessibilityRole="button" style={styles.editButton} onPress={startEditing}>
            <Text style={styles.editButtonText}>Bearbeiten</Text>
          </Pressable>
          <Pressable accessibilityRole="button" style={styles.deleteButton} onPress={handleDelete}>
            <Text style={styles.deleteButtonText}>Löschen</Text>
          </Pressable>
        </View>
      </View>
    );
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
        placeholderTextColor={colors.textSecondary}
        value={intervalMonths}
        onChangeText={setIntervalMonths}
      />
      <Text style={styles.label}>Nächstes fälliges Datum (JJJJ-MM-TT)</Text>
      <TextInput
        style={styles.textInput}
        placeholder="2027-01-15"
        placeholderTextColor={colors.textSecondary}
        value={nextDueDate}
        onChangeText={setNextDueDate}
      />
      <Text style={styles.label}>Notiz (optional)</Text>
      <TextInput
        style={styles.textInput}
        placeholder="z. B. Rücksprache mit Dr. …"
        placeholderTextColor={colors.textSecondary}
        value={note}
        onChangeText={setNote}
      />
      {error && <Text style={styles.errorText}>{error}</Text>}
      <View style={styles.actionsRow}>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: isSaving }}
          disabled={isSaving}
          style={[styles.saveButton, isSaving && styles.saveButtonDisabled]}
          onPress={handleSave}
        >
          <Text style={styles.saveButtonText}>Speichern</Text>
        </Pressable>
        {reminder && (
          <Pressable accessibilityRole="button" style={styles.cancelButton} onPress={() => setIsEditing(false)}>
            <Text style={styles.cancelButtonText}>Abbrechen</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    card: {
      backgroundColor: colors.surface,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      padding: tokens.spacing.md,
      margin: tokens.spacing.lg,
      marginBottom: 0,
    },
    title: {
      color: colors.textPrimary,
      fontSize: tokens.typography.fontSize.md,
      fontWeight: tokens.typography.fontWeight.bold,
      marginBottom: tokens.spacing.xs,
    },
    hintText: {
      color: colors.textSecondary,
      fontSize: tokens.typography.fontSize.sm,
      marginBottom: tokens.spacing.sm,
    },
    label: { color: colors.textPrimary, fontSize: tokens.typography.fontSize.sm, marginBottom: tokens.spacing.xs },
    textInput: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 8,
      padding: tokens.spacing.sm,
      color: colors.textPrimary,
      backgroundColor: colors.background,
      marginBottom: tokens.spacing.sm,
    },
    errorText: { color: colors.danger, fontSize: tokens.typography.fontSize.sm, marginBottom: tokens.spacing.sm },
    viewValue: {
      color: colors.textPrimary,
      fontSize: tokens.typography.fontSize.md,
      marginBottom: tokens.spacing.sm,
    },
    actionsRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: tokens.spacing.xs,
      marginTop: tokens.spacing.xs,
    },
    saveButton: {
      backgroundColor: colors.accent,
      borderRadius: 8,
      paddingVertical: tokens.spacing.sm,
      paddingHorizontal: tokens.spacing.md,
      alignItems: 'center',
    },
    saveButtonDisabled: { backgroundColor: colors.border },
    saveButtonText: {
      color: colors.surface,
      fontSize: tokens.typography.fontSize.md,
      fontWeight: tokens.typography.fontWeight.bold,
    },
    cancelButton: {
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.border,
      paddingVertical: tokens.spacing.sm,
      paddingHorizontal: tokens.spacing.md,
      alignItems: 'center',
    },
    cancelButtonText: { color: colors.textPrimary, fontSize: tokens.typography.fontSize.md },
    editButton: {
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.border,
      paddingVertical: tokens.spacing.sm,
      paddingHorizontal: tokens.spacing.md,
    },
    editButtonText: { color: colors.textPrimary, fontSize: tokens.typography.fontSize.md },
    deleteButton: {
      backgroundColor: colors.danger,
      borderRadius: 8,
      paddingVertical: tokens.spacing.sm,
      paddingHorizontal: tokens.spacing.md,
    },
    deleteButtonText: {
      color: colors.surface,
      fontSize: tokens.typography.fontSize.md,
      fontWeight: tokens.typography.fontWeight.bold,
    },
  });
}
