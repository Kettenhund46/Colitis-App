export interface SelectOption<T extends string> {
  key: T;
  label: string;
}

export type StoolConsistency = 'hart' | 'normal' | 'weich' | 'waessrig';

export const STOOL_CONSISTENCY_OPTIONS: SelectOption<StoolConsistency>[] = [
  { key: 'hart', label: 'Hart' },
  { key: 'normal', label: 'Normal' },
  { key: 'weich', label: 'Weich' },
  { key: 'waessrig', label: 'Wässrig' },
];

/**
 * Blutbeimengung in den vier Stufen des Mayo-Teilwerts. Die Zahlen sind
 * zugleich der Punktwert -- deshalb Zahlen und keine Schluessel.
 */
export type BloodLevel = 0 | 1 | 2 | 3;

export const BLOOD_LEVELS: BloodLevel[] = [0, 1, 2, 3];

/** Kurz, fuer Auswahlknoepfe und Listen. */
export const BLOOD_LEVEL_LABELS: Record<BloodLevel, string> = {
  0: 'Kein Blut',
  1: 'Schlieren',
  2: 'Sichtbares Blut',
  3: 'Nur Blut',
};

/** Ausfuehrlich, fuer das Formular und das Arztdokument. */
export const BLOOD_LEVEL_DESCRIPTIONS: Record<BloodLevel, string> = {
  0: 'Kein Blut gesehen',
  1: 'Schlieren, seltener als die Hälfte der Male',
  2: 'Sichtbares Blut bei den meisten Malen',
  3: 'Nur Blut, kein Stuhl',
};

export function isBloodLevel(value: number): value is BloodLevel {
  return value === 0 || value === 1 || value === 2 || value === 3;
}

/** Aus einer gespeicherten Zahl eine Stufe machen; alles Unbekannte gilt als kein Blut. */
export function toBloodLevel(value: number): BloodLevel {
  return isBloodLevel(value) ? value : 0;
}

export type TriggerCategory = 'ernaehrung' | 'stress' | 'schlaf' | 'medikament' | 'sonstiges';

export const TRIGGER_CATEGORY_OPTIONS: SelectOption<TriggerCategory>[] = [
  { key: 'ernaehrung', label: 'Ernährung' },
  { key: 'stress', label: 'Stress' },
  { key: 'schlaf', label: 'Schlaf' },
  { key: 'medikament', label: 'Medikament' },
  { key: 'sonstiges', label: 'Sonstiges' },
];

export type SymptomKey =
  | 'bauchschmerzen'
  | 'kraempfe'
  | 'muedigkeit'
  | 'fieber'
  | 'gelenkschmerzen'
  | 'dringlichkeit'
  | 'appetitlosigkeit'
  | 'gewichtsverlust';

export const SYMPTOM_OPTIONS: SelectOption<SymptomKey>[] = [
  { key: 'bauchschmerzen', label: 'Bauchschmerzen' },
  { key: 'kraempfe', label: 'Krämpfe' },
  { key: 'muedigkeit', label: 'Müdigkeit' },
  { key: 'fieber', label: 'Fieber' },
  { key: 'gelenkschmerzen', label: 'Gelenkschmerzen' },
  { key: 'dringlichkeit', label: 'Stuhldrang' },
  { key: 'appetitlosigkeit', label: 'Appetitlosigkeit' },
  { key: 'gewichtsverlust', label: 'Gewichtsverlust' },
];

export function labelFor(options: SelectOption<string>[], key: string): string {
  return options.find((option) => option.key === key)?.label ?? key;
}

export function buildTriggerLabels(categories: string[], foodTriggerNote: string | null): string[] {
  return categories.map((category) => {
    const label = labelFor(TRIGGER_CATEGORY_OPTIONS, category);
    if (category === 'ernaehrung' && foodTriggerNote) {
      return `${label} (${foodTriggerNote})`;
    }
    return label;
  });
}

export const FOOD_TRIGGER_SUGGESTIONS: string[] = ['Kaffee', 'Milchprodukte', 'Gluten', 'Scharfes', 'Alkohol', 'Zucker'];
