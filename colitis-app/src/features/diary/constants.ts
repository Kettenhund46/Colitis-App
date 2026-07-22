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
