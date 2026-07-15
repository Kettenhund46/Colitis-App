import { describe, it, expect } from 'vitest';
import { DRUG_WATCHLIST } from './drugWatchlist';

describe('DRUG_WATCHLIST', () => {
  it('contains 16 entries with both german and english names', () => {
    expect(DRUG_WATCHLIST).toHaveLength(16);
    for (const drug of DRUG_WATCHLIST) {
      expect(drug.germanName.length).toBeGreaterThan(0);
      expect(drug.englishName.length).toBeGreaterThan(0);
    }
  });

  it('has no duplicate german names', () => {
    const names = DRUG_WATCHLIST.map((d) => d.germanName);
    expect(new Set(names).size).toBe(names.length);
  });
});
