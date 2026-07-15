export interface FeedItem {
  id: string;
  source: 'pubmed' | 'awmf' | 'fda' | 'ema';
  category: 'studie' | 'leitlinie' | 'zulassung';
  title: string;
  summaryDe: string;
  publishedDate: string; // YYYY-MM-DD
  url: string;
}

export interface FeedPublication {
  generatedAt: string; // ISO-Zeitstempel
  items: FeedItem[];
}
