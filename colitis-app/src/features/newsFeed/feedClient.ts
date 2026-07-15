import { FEED_URL, FEED_CLIENT_TIMEOUT_MS } from './constants';
import type { RemoteFeedPublication } from './types';

export function parseFeedPublication(data: unknown): RemoteFeedPublication {
  const publication = data as { generatedAt?: unknown; items?: unknown };
  if (typeof publication.generatedAt !== 'string' || !Array.isArray(publication.items)) {
    throw new Error('Feed-Antwort hat ein unerwartetes Format.');
  }
  return { generatedAt: publication.generatedAt, items: publication.items as RemoteFeedPublication['items'] };
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
