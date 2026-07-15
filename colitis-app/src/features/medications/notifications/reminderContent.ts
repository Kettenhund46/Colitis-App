import type { ReminderContent } from './notificationService';

export function buildMedicationReminderContent(medication: { name: string; dose?: string | null }): ReminderContent {
  return {
    title: 'Medikamenten-Erinnerung',
    body: `${medication.name} – ${medication.dose}`,
  };
}

export function buildScreeningReminderContent(reminder: { note?: string | null }): ReminderContent {
  return {
    title: 'Vorsorge-Koloskopie',
    body: reminder.note && reminder.note.length > 0 ? reminder.note : 'Deine Vorsorge-Koloskopie ist fällig.',
  };
}
