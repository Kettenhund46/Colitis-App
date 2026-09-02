import type { VisitQuestion } from './types';

/** Laenger als das notiert niemand eine Frage ins Handy. */
export const MAX_QUESTION_LENGTH = 300;

export const NO_OPEN_QUESTIONS_TEXT = 'Keine offenen Fragen notiert.';

export const QUESTIONS_SECTION_TITLE = 'Fragen für den Termin';

export const QUESTIONS_HINT =
  'Was dir zwischen zwei Terminen einfällt, steht beim nächsten Mal ganz oben in der Zusammenfassung — auch im PDF.';

export const EMPTY_QUESTIONS_TITLE = 'Noch keine Fragen notiert';

export const EMPTY_QUESTIONS_DESCRIPTION =
  'Die Frage fällt einem nachts ein und ist im Sprechzimmer weg. Schreib sie auf, sobald sie kommt — sie wartet hier auf den nächsten Termin.';

export function isOpen(question: VisitQuestion): boolean {
  return question.answeredAt === null;
}

export function openQuestions(questions: VisitQuestion[]): VisitQuestion[] {
  return questions.filter(isOpen);
}

/**
 * Offene zuerst, innerhalb der Gruppen die aeltesten oben. Eine Frage, die
 * seit Wochen wartet, soll nicht unter den neuen verschwinden.
 */
export function sortForList(questions: VisitQuestion[]): VisitQuestion[] {
  return [...questions].sort((a, b) => {
    if (isOpen(a) !== isOpen(b)) {
      return isOpen(a) ? -1 : 1;
    }
    return a.createdAt.localeCompare(b.createdAt);
  });
}

export function isValidQuestionText(text: string): boolean {
  const trimmed = text.trim();
  return trimmed.length > 0 && trimmed.length <= MAX_QUESTION_LENGTH;
}

export function formatOpenCountLabel(count: number): string {
  if (count === 0) {
    return NO_OPEN_QUESTIONS_TEXT;
  }
  return count === 1 ? '1 offene Frage' : `${count} offene Fragen`;
}
