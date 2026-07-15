import { fetchWithTimeout } from './httpClient';
import type { FeedItem } from './types';

const ANTHROPIC_MESSAGES_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';
const ANTHROPIC_MODEL = 'claude-haiku-4-5-20251001';
const ANTHROPIC_TIMEOUT_MESSAGE = 'Anthropic request timed out.';
const SUMMARY_MAX_TOKENS = 300;

export function buildSummaryPrompt(item: FeedItem): string {
  return `Fasse die folgende medizinische Fachmeldung zu Colitis Ulcerosa in 2-3 Saetzen auf Deutsch zusammen. Zielgruppe ist ein Laie mit Colitis Ulcerosa, keine Fachperson. Ton: ruhig, sachlich, nicht alarmierend, keine Handlungsempfehlung, keine Panikmache. Gib ausschliesslich den Zusammenfassungstext zurueck, ohne Einleitung.

Titel: ${item.title}
Quelle: ${item.source}
Kategorie: ${item.category}
Link: ${item.url}`;
}

export function parseAnthropicSummary(data: unknown): string {
  const response = data as { content?: Array<{ type: string; text?: string }> };
  const textBlock = response.content?.find((block) => block.type === 'text' && block.text);
  if (!textBlock?.text) {
    throw new Error('Anthropic response did not contain a text block.');
  }
  return textBlock.text.trim();
}

export async function summarizeItem(item: FeedItem, apiKey: string): Promise<string> {
  const response = await fetchWithTimeout(ANTHROPIC_MESSAGES_URL, ANTHROPIC_TIMEOUT_MESSAGE, {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': ANTHROPIC_VERSION,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: ANTHROPIC_MODEL,
      max_tokens: SUMMARY_MAX_TOKENS,
      messages: [{ role: 'user', content: buildSummaryPrompt(item) }],
    }),
  });

  if (!response.ok) {
    throw new Error(`Anthropic request failed (status ${response.status})`);
  }

  const data = await response.json();
  return parseAnthropicSummary(data);
}

export async function summarizeNewItems(items: FeedItem[], apiKey: string): Promise<FeedItem[]> {
  const summarized: FeedItem[] = [];
  for (const item of items) {
    try {
      const summaryDe = await summarizeItem(item, apiKey);
      summarized.push({ ...item, summaryDe });
    } catch (error: unknown) {
      console.error(`Summarization failed for ${item.id}:`, error);
    }
  }
  return summarized;
}
