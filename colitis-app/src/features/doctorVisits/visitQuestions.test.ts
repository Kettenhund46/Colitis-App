import { describe, it, expect } from 'vitest';
import {
  isOpen,
  openQuestions,
  sortForList,
  isValidQuestionText,
  formatOpenCountLabel,
  MAX_QUESTION_LENGTH,
  NO_OPEN_QUESTIONS_TEXT,
} from './visitQuestions';
import type { VisitQuestion } from './types';

function question(overrides: Partial<VisitQuestion> & { id: number }): VisitQuestion {
  return {
    text: 'Kann ich die Dosis senken?',
    createdAt: '2026-08-01T09:00:00.000Z',
    answeredAt: null,
    ...overrides,
  };
}

describe('isOpen', () => {
  it('is open without an answered timestamp', () => {
    expect(isOpen(question({ id: 1 }))).toBe(true);
  });

  it('is closed once answered', () => {
    expect(isOpen(question({ id: 1, answeredAt: '2026-08-05T10:00:00.000Z' }))).toBe(false);
  });
});

describe('openQuestions', () => {
  it('keeps only the open ones', () => {
    const all = [
      question({ id: 1 }),
      question({ id: 2, answeredAt: '2026-08-05T10:00:00.000Z' }),
      question({ id: 3 }),
    ];
    expect(openQuestions(all).map((entry) => entry.id)).toEqual([1, 3]);
  });

  it('is empty without any question', () => {
    expect(openQuestions([])).toEqual([]);
  });
});

describe('sortForList', () => {
  it('puts open questions above answered ones', () => {
    const all = [
      question({ id: 1, answeredAt: '2026-08-05T10:00:00.000Z' }),
      question({ id: 2 }),
    ];
    expect(sortForList(all).map((entry) => entry.id)).toEqual([2, 1]);
  });

  it('keeps the oldest first inside each group', () => {
    const all = [
      question({ id: 1, createdAt: '2026-08-10T09:00:00.000Z' }),
      question({ id: 2, createdAt: '2026-08-01T09:00:00.000Z' }),
    ];
    expect(sortForList(all).map((entry) => entry.id)).toEqual([2, 1]);
  });

  it('does not change the array it was given', () => {
    const all = [question({ id: 1, answeredAt: '2026-08-05T10:00:00.000Z' }), question({ id: 2 })];
    sortForList(all);
    expect(all.map((entry) => entry.id)).toEqual([1, 2]);
  });
});

describe('isValidQuestionText', () => {
  it('rejects an empty field', () => {
    expect(isValidQuestionText('')).toBe(false);
  });

  it('rejects whitespace alone', () => {
    expect(isValidQuestionText('   ')).toBe(false);
  });

  it('accepts a normal question', () => {
    expect(isValidQuestionText('Wie lange noch Kortison?')).toBe(true);
  });

  it('accepts exactly the maximum length', () => {
    expect(isValidQuestionText('a'.repeat(MAX_QUESTION_LENGTH))).toBe(true);
  });

  it('rejects one character beyond it', () => {
    expect(isValidQuestionText('a'.repeat(MAX_QUESTION_LENGTH + 1))).toBe(false);
  });
});

describe('formatOpenCountLabel', () => {
  it('says plainly when nothing is open', () => {
    expect(formatOpenCountLabel(0)).toBe(NO_OPEN_QUESTIONS_TEXT);
  });

  it('uses the singular for one', () => {
    expect(formatOpenCountLabel(1)).toBe('1 offene Frage');
  });

  it('uses the plural above one', () => {
    expect(formatOpenCountLabel(4)).toBe('4 offene Fragen');
  });
});
