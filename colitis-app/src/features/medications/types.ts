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
  /** Einheiten je Einnahme, meist eine Tablette. */
  unitsPerIntake: number;
  /** Einheiten je Packung, oder null wenn nicht hinterlegt. */
  packUnits: number | null;
  /** Aktueller Bestand; null heisst: fuer dieses Medikament kein Vorrat gefuehrt. */
  stockUnits: number | null;
  /**
   * Kennung der geplanten Rezept-Erinnerung. Gehoert nicht zu
   * `MedicationInput` -- sie entsteht beim Planen, nicht im Formular.
   */
  supplyNotificationId: string | null;
  reminderTimes: MedicationReminderTime[];
}

export interface MedicationInput {
  name: string;
  dose: string;
  schedule: string;
  startDate: string;
  endDate: string | null;
  sideEffectsNote: string | null;
  unitsPerIntake: number;
  packUnits: number | null;
  stockUnits: number | null;
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

export interface MedicationIntake {
  /** Zeilen-ID aus medication_log — noetig, um eine einzelne Einnahme zu entfernen. */
  id: number;
  medicationId: number;
  /** ISO-Zeitstempel in UTC, wie ihn new Date().toISOString() liefert. */
  takenAt: string;
}
