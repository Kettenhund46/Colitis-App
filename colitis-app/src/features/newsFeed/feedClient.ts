import { FEED_URL, FEED_CLIENT_TIMEOUT_MS } from './constants';
import type { RemoteFeedItem, RemoteFeedPublication } from './types';

const VALID_SOURCES: ReadonlyArray<RemoteFeedItem['source']> = ['pubmed', 'awmf', 'fda', 'ema'];
const VALID_CATEGORIES: ReadonlyArray<RemoteFeedItem['category']> = ['studie', 'leitlinie', 'zulassung'];

function isValidRemoteFeedItem(item: unknown): item is RemoteFeedItem {
  const candidate = item as Partial<RemoteFeedItem> | null;
  if (!candidate || typeof candidate !== 'object') {
    return false;
  }
  return (
    typeof candidate.id === 'string' &&
    VALID_SOURCES.includes(candidate.source as RemoteFeedItem['source']) &&
    VALID_CATEGORIES.includes(candidate.category as RemoteFeedItem['category']) &&
    typeof candidate.title === 'string' &&
    typeof candidate.summaryDe === 'string' &&
    typeof candidate.publishedDate === 'string' &&
    typeof candidate.url === 'string'
  );
}

export function parseFeedPublication(data: unknown): RemoteFeedPublication {
  const publication = data as { generatedAt?: unknown; items?: unknown };
  if (typeof publication.generatedAt !== 'string' || !Array.isArray(publication.items)) {
    throw new Error('Feed-Antwort hat ein unerwartetes Format.');
  }
  if (!publication.items.every(isValidRemoteFeedItem)) {
    throw new Error('Feed-Antwort hat ein unerwartetes Format.');
  }
  return { generatedAt: publication.generatedAt, items: publication.items };
}

export async function fetchFeedPublication(): Promise<RemoteFeedPublication> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FEED_CLIENT_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(FEED_URL, { signal: controller.signal });
  } catch (error: unknown) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Feed-Anfrage abgebrochen (Zeitüberschreitung).');
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }

  if (!response.ok) {
    throw new Error(`Feed-Anfrage fehlgeschlagen (Status ${response.status})`);
  }

  const data: unknown = await response.json();
  return parseFeedPublication(data);
}
