export interface OnboardingStep {
  key: 'zweck' | 'daten' | 'erinnerung';
  title: string;
  paragraphs: string[];
  /**
   * Ob unter dem Text der Erinnerungs-Block eingeblendet wird. Er kommt aus
   * dem Tagebuch-Feature und schreibt selbst in die Einstellungen -- hier
   * steht nur, wo er hingehoert.
   */
  hasReminderSettings: boolean;
}

export const ONBOARDING_STEPS: OnboardingStep[] = [
  {
    key: 'zweck',
    title: 'Willkommen bei Colitis2Go',
    paragraphs: [
      'Die App begleitet dich im Alltag mit Colitis Ulcerosa: Sie hält fest, wie es dir geht, erinnert an deine Medikamente und findet die nächste Toilette.',
      'Aus dem, was du erfasst, entsteht auf Knopfdruck eine Zusammenfassung für den nächsten Arzttermin — statt Tagebuch, Medikamente und Auswertung einzeln durchzugehen.',
    ],
    hasReminderSettings: false,
  },
  {
    key: 'daten',
    title: 'Deine Daten bleiben auf diesem Gerät',
    paragraphs: [
      'Alles, was du einträgst, liegt verschlüsselt auf deinem Handy. Es gibt kein Konto, keine Anmeldung und keine Übertragung an einen Server.',
      'Das heißt auch: Geht das Gerät verloren, sind die Daten weg. Lege in den Einstellungen regelmäßig eine Sicherung an — sie ist mit einem Passwort geschützt, das nur du kennst.',
    ],
    hasReminderSettings: false,
  },
  {
    key: 'erinnerung',
    title: 'Sollen wir dich erinnern?',
    paragraphs: [
      'Ein Tagebuch hilft nur, wenn es gefüllt wird. Die App kann dich jeden Abend daran erinnern — die Uhrzeit bestimmst du.',
      'Das lässt sich jederzeit in den Einstellungen ändern.',
    ],
    hasReminderSettings: true,
  },
];

export function isLastStep(index: number): boolean {
  return index >= ONBOARDING_STEPS.length - 1;
}

/** Bleibt beim letzten Schritt stehen, statt ins Leere zu zeigen. */
export function nextStepIndex(index: number): number {
  return Math.min(index + 1, ONBOARDING_STEPS.length - 1);
}

export function formatStepProgress(index: number): string {
  return `Schritt ${index + 1} von ${ONBOARDING_STEPS.length}`;
}

export function formatPrimaryLabel(index: number): string {
  return isLastStep(index) ? 'Los geht’s' : 'Weiter';
}
