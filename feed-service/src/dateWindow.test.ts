import { describe, it, expect } from 'vitest';
import {
  ROLLING_WINDOW_DAYS,
  PUBMED_LOOKBACK_OVERLAP_DAYS,
  computeRollingWindowCutoff,
  isWithinRollingWindow,
  computePubmedSearchSinceDate,
} from './dateWindow';

const NOW = new Date('2026-07-15T05:00:00.000Z');

describe('ROLLING_WINDOW_DAYS / PUBMED_LOOKBACK_OVERLAP_DAYS', () => {
  it('are the values from the spec', () => {
    expect(ROLLING_WINDOW_DAYS).toBe(183);
    expect(PUBMED_LOOKBACK_OVERLAP_DAYS).toBe(10);
  });
});

describe('computeRollingWindowCutoff', () => {
  it('returns the date exactly 183 days before now', () => {
    expect(computeRollingWindowCutoff(NOW)).toBe('2026-01-13');
  });
});

describe('isWithinRollingWindow', () => {
  it('keeps an item exactly at the 183-day cutoff', () => {
    expect(isWithinRollingWindow('2026-01-13', NOW)).toBe(true);
  });

  it('drops an item one day older than the cutoff', () => {
    expect(isWithinRollingWindow('2026-01-12', NOW)).toBe(false);
  });

  it('keeps a recent item', () => {
    expect(isWithinRollingWindow('2026-07-14', NOW)).toBe(true);
  });
});

describe('computePubmedSearchSinceDate', () => {
  it('falls back to the full rolling window when there is no previous publication', () => {
    expect(computePubmedSearchSinceDate(null, NOW)).toBe('2026-01-13');
  });

  it('uses the previous generatedAt minus the overlap when a previous publication exists', () => {
    expect(computePubmedSearchSinceDate('2026-07-08T05:00:00.000Z', NOW)).toBe('2026-06-28');
  });
});
