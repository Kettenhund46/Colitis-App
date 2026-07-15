import { fetchWithTimeout } from './httpClient';
import type { FeedPublication } from './types';

const FEED_CONTENTS_URL = 'https://api.github.com/repos/Kettenhund46/colitis-app-feed/contents/feed.json';
const GITHUB_TIMEOUT_MESSAGE = 'GitHub contents request timed out.';

export interface FeedFileState {
  publication: FeedPublication | null;
  sha: string | null;
}

export async function fetchCurrentFeedFile(token: string): Promise<FeedFileState> {
  const response = await fetchWithTimeout(FEED_CONTENTS_URL, GITHUB_TIMEOUT_MESSAGE, {
    headers: { authorization: `Bearer ${token}`, accept: 'application/vnd.github+json' },
  });

  if (response.status === 404) {
    return { publication: null, sha: null };
  }
  if (!response.ok) {
    throw new Error(`GitHub contents GET failed (status ${response.status})`);
  }

  const data = (await response.json()) as { content: string; sha: string };
  const decoded = Buffer.from(data.content, 'base64').toString('utf-8');
  return { publication: JSON.parse(decoded) as FeedPublication, sha: data.sha };
}

export function hasFeedChanged(previous: FeedPublication | null, next: FeedPublication): boolean {
  if (!previous) {
    return true;
  }
  return JSON.stringify(previous.items) !== JSON.stringify(next.items);
}

export async function publishFeed(
  publication: FeedPublication,
  previousSha: string | null,
  token: string
): Promise<void> {
  const content = Buffer.from(JSON.stringify(publication, null, 2)).toString('base64');
  const body: { message: string; content: string; branch: string; sha?: string } = {
    message: `feed update: ${publication.generatedAt}`,
    content,
    branch: 'main',
  };
  if (previousSha) {
    body.sha = previousSha;
  }

  const response = await fetchWithTimeout(FEED_CONTENTS_URL, GITHUB_TIMEOUT_MESSAGE, {
    method: 'PUT',
    headers: {
      authorization: `Bearer ${token}`,
      accept: 'application/vnd.github+json',
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(`GitHub contents PUT failed (status ${response.status})`);
  }
}
