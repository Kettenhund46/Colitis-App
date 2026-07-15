import { describe, it, expect } from 'vitest';
import { sourceLabelFor } from './sourceLabel';
import type { FeedItem } from './types';

describe('sourceLabelFor', () => {
  it('maps pubmed to PubMed', () => {
    expect(sourceLabelFor('pubmed')).toBe('PubMed');
  });

  it('maps awmf to AWMF-Leitlinie', () => {
    expect(sourceLabelFor('awmf')).toBe('AWMF-Leitlinie');
  });

  it('maps fda to FDA', () => {
    expect(sourceLabelFor('fda')).toBe('FDA');
  });

  it('maps ema to EMA', () => {
    expect(sourceLabelFor('ema')).toBe('EMA');
  });

  it('falls back to the raw value for an unrecognized source instead of returning undefined', () => {
    expect(sourceLabelFor('unknown' as FeedItem['source'])).toBe('unknown');
  });
});
