export interface RemoteFeedItem {
  id: string;
  source: 'pubmed' | 'awmf' | 'fda' | 'ema';
  category: 'studie' | 'leitlinie' | 'zulassung';
  title: string;
  summaryDe: string;
  publishedDate: string; // YYYY-MM-DD
  url: string;
}

export interface RemoteFeedPublication {
  generatedAt: string;
  items: RemoteFeedItem[];
}

export interface FeedItem extends RemoteFeedItem {
  isRead: boolean;
}
