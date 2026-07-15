import { fetchWithTimeout } from './httpClient';
import type { FeedItem } from './types';

// LIVE-FORMAT VERIFICATION NOTE (see task-4-report.md for full detail):
//
// The real AWMF register pages (https://register.awmf.org/de/leitlinien/detail/<nr>)
// were checked live before this task was finalized. The result: the page is a fully
// client-side rendered Angular/Ionic single-page app. A plain HTTP GET (no JS
// execution, which is exactly what `fetchWithTimeout` + `.text()` performs) returns
// only the empty app shell (`<app-root></app-root>` plus <script> tags) - it never
// contains "Version X.Y" or a publication date anywhere in the response body,
// regardless of guideline or version. The regex-based parsing approach below is kept
// exactly as specified in the task brief (there is no HTML text to adjust the regex
// against - the page has none at all), and its fail-soft behavior (parse failure ->
// log and skip, never throw) is correct and preserved. However, that means in
// production this will currently *always* hit the "could not parse" branch for both
// guidelines and never actually detect a version change. Making this functionally
// work against the live site would require calling AWMF's internal
// leitlinien-api.awmf.org backend, which requires a client_id/client_secret pair
// found embedded in AWMF's minified frontend bundle under a variable named
// `awmf_admin_api_url` (alongside a login()/user-token flow in the same client).
// Using an extracted credential like that - not a documented/public API - was judged
// out of scope and inappropriate to embed without an explicit, sanctioned
// integration with AWMF. This is flagged for a human decision; see the task report.
const AWMF_TIMEOUT_MESSAGE = 'AWMF request timed out.';

export interface AwmfGuideline {
  registerNumber: string;
  title: string;
  url: string;
}

export const AWMF_WATCHED_GUIDELINES: AwmfGuideline[] = [
  {
    registerNumber: '021-009',
    title: 'S3-Leitlinie Colitis ulcerosa',
    url: 'https://register.awmf.org/de/leitlinien/detail/021-009',
  },
  {
    registerNumber: '073-027',
    title: 'S3-Leitlinie Klinische Ernaehrung bei chronisch-entzuendlichen Darmerkrankungen',
    url: 'https://register.awmf.org/de/leitlinien/detail/073-027',
  },
];

interface AwmfVersionInfo {
  version: string;
  publishedDate: string;
}

export function parseAwmfVersionInfo(html: string): AwmfVersionInfo | null {
  const versionMatch = html.match(/Version\s+(\d+(?:\.\d+)?)/);
  const dateMatch = html.match(/(\d{2})\.(\d{2})\.(\d{4})/);
  if (!versionMatch || !dateMatch) {
    return null;
  }
  const [, day, month, year] = dateMatch;
  return { version: versionMatch[1], publishedDate: `${year}-${month}-${day}` };
}

function alreadyKnown(guideline: AwmfGuideline, version: string, previousItems: FeedItem[]): boolean {
  const expectedId = `awmf:${guideline.registerNumber}:v${version}`;
  return previousItems.some((item) => item.id === expectedId);
}

export async function fetchAwmfItems(previousItems: FeedItem[]): Promise<FeedItem[]> {
  const items: FeedItem[] = [];

  for (const guideline of AWMF_WATCHED_GUIDELINES) {
    try {
      const response = await fetchWithTimeout(guideline.url, AWMF_TIMEOUT_MESSAGE);
      if (!response.ok) {
        console.error(`AWMF request failed for ${guideline.registerNumber} (status ${response.status})`);
        continue;
      }
      const html = await response.text();
      const info = parseAwmfVersionInfo(html);
      if (!info) {
        console.error(`Could not parse AWMF version info for ${guideline.registerNumber}`);
        continue;
      }
      if (alreadyKnown(guideline, info.version, previousItems)) {
        continue;
      }
      items.push({
        id: `awmf:${guideline.registerNumber}:v${info.version}`,
        source: 'awmf',
        category: 'leitlinie',
        title: guideline.title,
        summaryDe: '',
        publishedDate: info.publishedDate,
        url: guideline.url,
      });
    } catch (error: unknown) {
      console.error(`AWMF fetch failed for ${guideline.registerNumber}:`, error);
    }
  }

  return items;
}
