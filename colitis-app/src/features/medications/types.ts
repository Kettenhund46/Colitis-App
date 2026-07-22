export interface MedicationReminderTime {
  id: number;
  time: string;
  notificationId: string | null;
}

export interface Medication {
  id: number;
  name: string;
  dose: string;
  schedule: string;
  startDate: string;
  endDate: string | null;
  sideEffectsNote: string | null;
  reminderTimes: MedicationReminderTime[];
}

export interface MedicationInput {
  name: string;
  dose: string;
  schedule: string;
  startDate: string;
  endDate: string | null;
  sideEffectsNote: string | null;
  reminderTimes: string[];
}

export interface ScreeningReminder {
  id: number;
  intervalMonths: number;
  nextDueDate: string;
  note: string | null;
  notificationId: string | null;
}

export interface NewScreeningReminderInput {
  intervalMonths: number;
  nextDueDate: string;
  note: string | null;
}
