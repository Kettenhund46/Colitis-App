import type { FeedItem } from './types';

const SOURCE_LABELS: Record<FeedItem['source'], string> = {
  pubmed: 'PubMed',
  awmf: 'AWMF-Leitlinie',
  fda: 'FDA',
  ema: 'EMA',
};

export function sourceLabelFor(source: FeedItem['source']): string {
  return SOURCE_LABELS[source];
}
