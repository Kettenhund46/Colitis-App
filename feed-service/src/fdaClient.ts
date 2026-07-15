import { fetchWithTimeout } from './httpClient';
import type { FeedItem } from './types';
import type { WatchedDrug } from './drugWatchlist';

// LIVE-FORMAT VERIFICATION NOTE (see task-5-report.md for full detail):
//
// api.fda.gov/drug/drugsfda.json was checked live before this task was finalized
// (query: products.active_ingredients.name:"UPADACITINIB"). The real response shape
// matches what this parser assumes: results[].products[].brand_name and
// results[].submissions[].submission_status_date / submission_type are all present
// as documented. The sort=submissions.submission_status_date:desc parameter also
// behaves as expected - it orders results[] so that results[0] is the application
// with the most recently updated submission (verified against a drug with four
// separate applications), which is what parseFdaResponse relies on. No changes to
// the parser were necessary.
const FDA_DRUGSFDA_URL = 'https://api.fda.gov/drug/drugsfda.json';
const FDA_TIMEOUT_MESSAGE = 'FDA request timed out.';
const FDA_LABEL_URL = 'https://www.accessdata.fda.gov/scripts/cder/daf/index.cfm';

export function buildFdaSearchUrl(englishName: string): string {
  const params = new URLSearchParams({
    search: `products.active_ingredients.name:"${englishName.toUpperCase()}"`,
    sort: 'submissions.submission_status_date:desc',
    limit: '1',
  });
  return `${FDA_DRUGSFDA_URL}?${params.toString()}`;
}

interface FdaSubmission {
  submission_status_date?: string;
  submission_type?: string;
}

interface FdaResult {
  submissions?: FdaSubmission[];
  products?: Array<{ brand_name?: string }>;
}

function parseFdaSubmissionDate(raw: string): string {
  return `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`;
}

export function parseFdaResponse(data: unknown, drug: WatchedDrug): FeedItem | null {
  const response = data as { results?: FdaResult[] };
  const result = response.results?.[0];
  if (!result) {
    return null;
  }

  const datedSubmissions = (result.submissions ?? []).filter(
    (submission): submission is FdaSubmission & { submission_status_date: string } =>
      Boolean(submission.submission_status_date)
  );
  if (datedSubmissions.length === 0) {
    return null;
  }

  const latest = datedSubmissions.reduce((newest, current) =>
    current.submission_status_date > newest.submission_status_date ? current : newest
  );
  const publishedDate = parseFdaSubmissionDate(latest.submission_status_date);
  const brandName = result.products?.[0]?.brand_name;
  const title = brandName
    ? `${drug.germanName} (${brandName}): ${latest.submission_type ?? 'Meldung'} bei der FDA`
    : `${drug.germanName}: ${latest.submission_type ?? 'Meldung'} bei der FDA`;

  return {
    id: `fda:${drug.englishName.toLowerCase()}:${publishedDate}`,
    source: 'fda',
    category: 'zulassung',
    title,
    summaryDe: '',
    publishedDate,
    url: FDA_LABEL_URL,
  };
}

export async function fetchFdaItems(watchlist: WatchedDrug[], previousItems: FeedItem[]): Promise<FeedItem[]> {
  const items: FeedItem[] = [];

  for (const drug of watchlist) {
    try {
      const response = await fetchWithTimeout(buildFdaSearchUrl(drug.englishName), FDA_TIMEOUT_MESSAGE);
      if (!response.ok) {
        if (response.status !== 404) {
          console.error(`FDA request failed for ${drug.englishName} (status ${response.status})`);
        }
        continue;
      }
      const data = await response.json();
      const item = parseFdaResponse(data, drug);
      if (!item || previousItems.some((existing) => existing.id === item.id)) {
        continue;
      }
      items.push(item);
    } catch (error: unknown) {
      console.error(`FDA fetch failed for ${drug.englishName}:`, error);
    }
  }

  return items;
}
