import { describe, it, expect } from 'vitest';
import { formatOccurredAt } from './formatting';

describe('formatOccurredAt', () => {
  it('formats an ISO timestamp as a German date and time', () => {
    expect(formatOccurredAt('2026-07-08T10:05:00.000Z')).toMatch(/^08\.07\.2026, \d{2}:\d{2}$/);
  });
});
