# Phase 2, Teil A: News-Feed Datenquelle – Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ein wöchentlicher GitHub-Actions-Cronjob im bestehenden privaten Repo, der PubMed, AWMF-Leitlinien und FDA/EMA-Meldungen zu Colitis Ulcerosa abfragt, neue Treffer per Claude API auf Deutsch zusammenfasst und als `feed.json` in einem separaten öffentlichen Mini-Repo veröffentlicht.

**Architecture:** Neuer, eigenständiger TypeScript-Ordner `feed-service/` (kein Expo/React-Native-Code, eigenes `package.json`), ausgeführt über `tsx`. Reine Logik (Datum/Fenster/Merge, Prompt-Bau) ist strikt von I/O (fetch-Aufrufe zu PubMed/AWMF/openFDA/EMA/Claude/GitHub) getrennt, damit alles außer den eigentlichen Netzwerkaufrufen mit Vitest getestet werden kann. Ein dünner Orchestrator verbindet alle Quellen mit Einzel-Try/Catch und entscheidet über den Exit-Code.

**Tech Stack:** TypeScript (~6.0.3), Node.js (nativer `fetch`, kein Zusatzpaket), Vitest (^4.1.10), `tsx` als Ausführer, GitHub Actions, GitHub REST Contents API, Anthropic Messages API (Claude Haiku).

## Global Constraints

- Zielverzeichnis: `feed-service/` im Repo-Root (`D:\Claude`), unabhängig von `colitis-app/`.
- Alle Quell-Module (PubMed/AWMF/FDA/EMA) haben eigenes Try/Catch; ein Ausfall blockiert die anderen nicht (Spec §6).
- Schlagen **alle** Quellen fehl → Prozess beendet sich mit Exit-Code `1` (GitHub sendet automatisch eine Fehler-Mail).
- Rollierendes Fenster: 183 Tage (~6 Monate). Items mit `publishedDate` älter als das Fenster werden entfernt.
- PubMed-Zeitraum: seit `generatedAt` der letzten Publikation minus 10 Tage Sicherheitsüberlappung; bei fehlender letzter Publikation: 183 Tage zurück.
- Datenmodell exakt wie in der Spec (Abschnitt 5.2):
  ```typescript
  interface FeedItem {
    id: string;
    source: 'pubmed' | 'awmf' | 'fda' | 'ema';
    category: 'studie' | 'leitlinie' | 'zulassung';
    title: string;
    summaryDe: string;
    publishedDate: string; // YYYY-MM-DD
    url: string;
  }
  interface FeedPublication {
    generatedAt: string; // ISO-Zeitstempel
    items: FeedItem[];
  }
  ```
- Claude-Modell für Zusammenfassungen: Haiku (`claude-haiku-4-5-20251001`), 2-3 Sätze, laienverständliches, ruhiges Deutsch, keine Handlungsempfehlung.
- Veröffentlichungs-Ziel: `https://api.github.com/repos/Kettenhund46/colitis-app-feed/contents/feed.json` (GitHub Contents API, PUT), Ziel-Branch `main`. Kein Commit, wenn sich der Inhalt nicht ändert.
- GitHub-Secrets im privaten Repo (werden von Adrian manuell angelegt, nicht Teil der automatisierten Umsetzung): `ANTHROPIC_API_KEY`, `FEED_PUBLISH_TOKEN`.
- Alle Log-/Fehlermeldungen im Code dürfen Englisch oder Deutsch sein (kein Nutzer-UI, nur Server-Logs) – Konsistenz ist hier zweitrangig; wo unsicher, Englisch verwenden (Konsole liest ggf. auch GitHub-Actions-Betreiber, nicht Adrian direkt in der App).
- Kein neues Netzwerk-Paket (z. B. `node-fetch`, `axios`, `@anthropic-ai/sdk`) hinzufügen – natives `fetch` von Node.js ≥ 18 genügt (Workflow nutzt Node 22).
- Für Quellen ohne 100% sicheres, dokumentiertes Antwortformat (openFDA `drugsfda.json`, EMA-RSS) gilt: die Parser-Funktion wird so geschrieben, wie in diesem Plan spezifiziert; der jeweilige Task-Schritt enthält einen expliziten Hinweis, einmal live zu prüfen und bei Abweichung Parser + Tests entsprechend der tatsächlichen Struktur anzupassen (kein Platzhalter im Code, sondern eine reale, lauffähige Implementierung als Ausgangsbasis).

---

### Task 1: Projekt-Setup (feed-service/)

**Files:**
- Create: `.gitignore` (Repo-Root, existiert noch nicht)
- Create: `feed-service/package.json`
- Create: `feed-service/tsconfig.json`
- Create: `feed-service/vitest.config.ts`
- Create: `feed-service/src/types.ts`
- Create: `feed-service/src/drugWatchlist.ts`
- Test: `feed-service/src/drugWatchlist.test.ts`

**Interfaces:**
- Produces: `FeedItem`, `FeedPublication` (aus `feed-service/src/types.ts`) – von allen späteren Tasks verwendet.
- Produces: `WatchedDrug` Typ und `DRUG_WATCHLIST: WatchedDrug[]` (aus `feed-service/src/drugWatchlist.ts`) – von Task 5 (FDA/EMA) verwendet.

- [ ] **Step 1: Root-`.gitignore` anlegen**

Datei `D:\Claude\.gitignore` existiert noch nicht (nur `colitis-app/.gitignore`, das nicht auf `feed-service/` wirkt). Neue Datei:

```
feed-service/node_modules/
feed-service/dist/
feed-service/*.tsbuildinfo
```

- [ ] **Step 2: `feed-service/package.json` anlegen**

```json
{
  "name": "colitis-app-feed-service",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "vitest run",
    "start": "tsx src/index.ts"
  },
  "devDependencies": {
    "@types/node": "^24.0.0",
    "typescript": "~6.0.3",
    "tsx": "^4.19.0",
    "vitest": "^4.1.10"
  }
}
```

- [ ] **Step 3: `feed-service/tsconfig.json` anlegen**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ES2022",
    "moduleResolution": "Bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "types": ["node"],
    "outDir": "dist"
  },
  "include": ["src/**/*.ts"]
}
```

- [ ] **Step 4: `feed-service/vitest.config.ts` anlegen**

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: false,
    passWithNoTests: true,
  },
});
```

- [ ] **Step 5: `feed-service/src/types.ts` anlegen**

```typescript
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
```

- [ ] **Step 6: `feed-service/src/drugWatchlist.ts` anlegen**

Deutsche und englische Wirkstoffnamen getrennt, da FDA/openFDA ausschließlich US-englische Freinamen verwendet (z. B. "Mesalamine" statt "Mesalazin", "Azathioprine" statt "Azathioprin"), während EMA/AWMF überwiegend die deutschen bzw. INN-nahen Namen nutzen.

```typescript
export interface WatchedDrug {
  germanName: string;
  englishName: string;
}

export const DRUG_WATCHLIST: WatchedDrug[] = [
  { germanName: 'Infliximab', englishName: 'Infliximab' },
  { germanName: 'Adalimumab', englishName: 'Adalimumab' },
  { germanName: 'Golimumab', englishName: 'Golimumab' },
  { germanName: 'Vedolizumab', englishName: 'Vedolizumab' },
  { germanName: 'Ustekinumab', englishName: 'Ustekinumab' },
  { germanName: 'Mirikizumab', englishName: 'Mirikizumab' },
  { germanName: 'Guselkumab', englishName: 'Guselkumab' },
  { germanName: 'Tofacitinib', englishName: 'Tofacitinib' },
  { germanName: 'Filgotinib', englishName: 'Filgotinib' },
  { germanName: 'Upadacitinib', englishName: 'Upadacitinib' },
  { germanName: 'Ozanimod', englishName: 'Ozanimod' },
  { germanName: 'Etrasimod', englishName: 'Etrasimod' },
  { germanName: 'Mesalazin', englishName: 'Mesalamine' },
  { germanName: 'Budesonid', englishName: 'Budesonide' },
  { germanName: 'Azathioprin', englishName: 'Azathioprine' },
  { germanName: 'Methotrexat', englishName: 'Methotrexate' },
];
```

- [ ] **Step 7: Abhängigkeiten installieren**

Run: `cd feed-service && npm install`
Expected: `node_modules/` wird angelegt, kein Fehler.

- [ ] **Step 8: Smoke-Test schreiben**

`feed-service/src/drugWatchlist.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { DRUG_WATCHLIST } from './drugWatchlist';

describe('DRUG_WATCHLIST', () => {
  it('contains 16 entries with both german and english names', () => {
    expect(DRUG_WATCHLIST).toHaveLength(16);
    for (const drug of DRUG_WATCHLIST) {
      expect(drug.germanName.length).toBeGreaterThan(0);
      expect(drug.englishName.length).toBeGreaterThan(0);
    }
  });

  it('has no duplicate german names', () => {
    const names = DRUG_WATCHLIST.map((d) => d.germanName);
    expect(new Set(names).size).toBe(names.length);
  });
});
```

- [ ] **Step 9: Tests ausführen**

Run: `cd feed-service && npm test`
Expected: 2 Tests, alle grün.

- [ ] **Step 10: TypeScript-Check**

Run: `cd feed-service && npx tsc --noEmit`
Expected: keine Fehler.

- [ ] **Step 11: Commit**

```bash
git add .gitignore feed-service/
git commit -m "feat: feed-service Projekt-Grundgerüst anlegen"
```

---

### Task 2: Datum-, Fenster- und Merge-Logik

**Files:**
- Create: `feed-service/src/dateWindow.ts`
- Test: `feed-service/src/dateWindow.test.ts`
- Create: `feed-service/src/mergeAndWindow.ts`
- Test: `feed-service/src/mergeAndWindow.test.ts`

**Interfaces:**
- Consumes: `FeedItem`, `FeedPublication` (aus Task 1, `feed-service/src/types.ts`)
- Produces: `ROLLING_WINDOW_DAYS: number`, `PUBMED_LOOKBACK_OVERLAP_DAYS: number`, `computeRollingWindowCutoff(now: Date): string`, `isWithinRollingWindow(publishedDate: string, now: Date): boolean`, `computePubmedSearchSinceDate(previousGeneratedAt: string | null, now: Date): string` (aus `dateWindow.ts`) – von Task 3 (PubMed) und Task 7 (Publish) verwendet.
- Produces: `mergeAndFilterItems(existing: FeedItem[], newItems: FeedItem[], now: Date): FeedItem[]`, `buildPublication(items: FeedItem[], now: Date): FeedPublication` (aus `mergeAndWindow.ts`) – von Task 8 (Orchestrator) verwendet.

- [ ] **Step 1: Fehlschlagenden Test für `computeRollingWindowCutoff` und `isWithinRollingWindow` schreiben**

`feed-service/src/dateWindow.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import {
  ROLLING_WINDOW_DAYS,
  PUBMED_LOOKBACK_OVERLAP_DAYS,
  computeRollingWindowCutoff,
  isWithinRollingWindow,
  computePubmedSearchSinceDate,
} from './dateWindow';

const NOW = new Date('2026-07-15T05:00:00.000Z');

describe('ROLLING_WINDOW_DAYS / PUBMED_LOOKBACK_OVERLAP_DAYS', () => {
  it('are the values from the spec', () => {
    expect(ROLLING_WINDOW_DAYS).toBe(183);
    expect(PUBMED_LOOKBACK_OVERLAP_DAYS).toBe(10);
  });
});

describe('computeRollingWindowCutoff', () => {
  it('returns the date exactly 183 days before now', () => {
    expect(computeRollingWindowCutoff(NOW)).toBe('2026-01-13');
  });
});

describe('isWithinRollingWindow', () => {
  it('keeps an item exactly at the 183-day cutoff', () => {
    expect(isWithinRollingWindow('2026-01-13', NOW)).toBe(true);
  });

  it('drops an item one day older than the cutoff', () => {
    expect(isWithinRollingWindow('2026-01-12', NOW)).toBe(false);
  });

  it('keeps a recent item', () => {
    expect(isWithinRollingWindow('2026-07-14', NOW)).toBe(true);
  });
});

describe('computePubmedSearchSinceDate', () => {
  it('falls back to the full rolling window when there is no previous publication', () => {
    expect(computePubmedSearchSinceDate(null, NOW)).toBe('2026-01-13');
  });

  it('uses the previous generatedAt minus the overlap when a previous publication exists', () => {
    expect(computePubmedSearchSinceDate('2026-07-08T05:00:00.000Z', NOW)).toBe('2026-06-28');
  });
});
```

- [ ] **Step 2: Test ausführen, Fehlschlag bestätigen**

Run: `cd feed-service && npx vitest run src/dateWindow.test.ts`
Expected: FAIL mit "Cannot find module './dateWindow'"

- [ ] **Step 3: `dateWindow.ts` implementieren**

```typescript
export const ROLLING_WINDOW_DAYS = 183;
export const PUBMED_LOOKBACK_OVERLAP_DAYS = 10;

function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function computeRollingWindowCutoff(now: Date): string {
  const cutoff = new Date(now);
  cutoff.setUTCDate(cutoff.getUTCDate() - ROLLING_WINDOW_DAYS);
  return toIsoDate(cutoff);
}

export function isWithinRollingWindow(publishedDate: string, now: Date): boolean {
  return publishedDate >= computeRollingWindowCutoff(now);
}

export function computePubmedSearchSinceDate(previousGeneratedAt: string | null, now: Date): string {
  if (previousGeneratedAt === null) {
    return computeRollingWindowCutoff(now);
  }
  const lastRun = new Date(previousGeneratedAt);
  lastRun.setUTCDate(lastRun.getUTCDate() - PUBMED_LOOKBACK_OVERLAP_DAYS);
  return toIsoDate(lastRun);
}
```

- [ ] **Step 4: Test erneut ausführen, Erfolg bestätigen**

Run: `cd feed-service && npx vitest run src/dateWindow.test.ts`
Expected: 7 Tests, alle grün.

- [ ] **Step 5: Fehlschlagenden Test für Merge-Logik schreiben**

`feed-service/src/mergeAndWindow.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { mergeAndFilterItems, buildPublication } from './mergeAndWindow';
import type { FeedItem } from './types';

const NOW = new Date('2026-07-15T05:00:00.000Z');

function makeItem(overrides: Partial<FeedItem>): FeedItem {
  return {
    id: 'pubmed:1',
    source: 'pubmed',
    category: 'studie',
    title: 'Test',
    summaryDe: 'Zusammenfassung.',
    publishedDate: '2026-07-01',
    url: 'https://example.com/1',
    ...overrides,
  };
}

describe('mergeAndFilterItems', () => {
  it('combines existing and new items, deduplicated by id', () => {
    const existing = [makeItem({ id: 'pubmed:1', title: 'Alt' })];
    const incoming = [makeItem({ id: 'pubmed:1', title: 'Neu' }), makeItem({ id: 'pubmed:2' })];

    const result = mergeAndFilterItems(existing, incoming, NOW);

    expect(result).toHaveLength(2);
    expect(result.find((item) => item.id === 'pubmed:1')?.title).toBe('Neu');
  });

  it('drops items outside the rolling window', () => {
    const existing = [makeItem({ id: 'pubmed:old', publishedDate: '2026-01-01' })];

    const result = mergeAndFilterItems(existing, [], NOW);

    expect(result).toHaveLength(0);
  });

  it('sorts items by publishedDate descending', () => {
    const existing = [
      makeItem({ id: 'pubmed:1', publishedDate: '2026-06-01' }),
      makeItem({ id: 'pubmed:2', publishedDate: '2026-07-01' }),
    ];

    const result = mergeAndFilterItems(existing, [], NOW);

    expect(result.map((item) => item.id)).toEqual(['pubmed:2', 'pubmed:1']);
  });
});

describe('buildPublication', () => {
  it('wraps items with the current timestamp', () => {
    const items = [makeItem({})];

    const publication = buildPublication(items, NOW);

    expect(publication.generatedAt).toBe(NOW.toISOString());
    expect(publication.items).toBe(items);
  });
});
```

- [ ] **Step 6: Test ausführen, Fehlschlag bestätigen**

Run: `cd feed-service && npx vitest run src/mergeAndWindow.test.ts`
Expected: FAIL mit "Cannot find module './mergeAndWindow'"

- [ ] **Step 7: `mergeAndWindow.ts` implementieren**

```typescript
import type { FeedItem, FeedPublication } from './types';
import { isWithinRollingWindow } from './dateWindow';

export function mergeAndFilterItems(existing: FeedItem[], newItems: FeedItem[], now: Date): FeedItem[] {
  const byId = new Map<string, FeedItem>();
  for (const item of existing) {
    byId.set(item.id, item);
  }
  for (const item of newItems) {
    byId.set(item.id, item);
  }

  const merged = Array.from(byId.values()).filter((item) => isWithinRollingWindow(item.publishedDate, now));
  merged.sort((a, b) => (a.publishedDate < b.publishedDate ? 1 : a.publishedDate > b.publishedDate ? -1 : 0));
  return merged;
}

export function buildPublication(items: FeedItem[], now: Date): FeedPublication {
  return { generatedAt: now.toISOString(), items };
}
```

- [ ] **Step 8: Test erneut ausführen, Erfolg bestätigen**

Run: `cd feed-service && npx vitest run src/mergeAndWindow.test.ts`
Expected: 4 Tests, alle grün.

- [ ] **Step 9: Gesamte Test-Suite und TypeScript-Check**

Run: `cd feed-service && npm test && npx tsc --noEmit`
Expected: alle Tests grün (13 insgesamt), keine TypeScript-Fehler.

- [ ] **Step 10: Commit**

```bash
git add feed-service/src/dateWindow.ts feed-service/src/dateWindow.test.ts feed-service/src/mergeAndWindow.ts feed-service/src/mergeAndWindow.test.ts
git commit -m "feat: Datum-, Fenster- und Merge-Logik fuer den News-Feed implementieren"
```

---

### Task 3: HTTP-Hilfsfunktion und PubMed-Client

**Files:**
- Create: `feed-service/src/constants.ts`
- Create: `feed-service/src/httpClient.ts`
- Test: `feed-service/src/httpClient.test.ts`
- Create: `feed-service/src/pubmedClient.ts`
- Test: `feed-service/src/pubmedClient.test.ts`

**Interfaces:**
- Consumes: `FeedItem` (Task 1, `types.ts`); `computePubmedSearchSinceDate` (Task 2, `dateWindow.ts`, wird vom Orchestrator in Task 8 aufgerufen, nicht direkt hier)
- Produces: `HTTP_CLIENT_TIMEOUT_MS: number` (`constants.ts`) – von Task 4, 5, 7 verwendet
- Produces: `fetchWithTimeout(url: string, timeoutMessage: string): Promise<Response>` (`httpClient.ts`) – von Task 4, 5 verwendet
- Produces: `fetchPubmedItems(sinceDate: string): Promise<FeedItem[]>` (`pubmedClient.ts`) – von Task 8 (Orchestrator) verwendet

- [ ] **Step 1: `feed-service/src/constants.ts` anlegen**

```typescript
export const HTTP_CLIENT_TIMEOUT_MS = 15000;
```

- [ ] **Step 2: Fehlschlagenden Test für `fetchWithTimeout` schreiben**

`feed-service/src/httpClient.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchWithTimeout } from './httpClient';
import { HTTP_CLIENT_TIMEOUT_MS } from './constants';

const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockReset();
});

describe('fetchWithTimeout', () => {
  it('returns the response on success', async () => {
    const response = { ok: true, status: 200 };
    fetchMock.mockResolvedValueOnce(response);

    const result = await fetchWithTimeout('https://example.com', 'timed out');

    expect(result).toBe(response);
  });

  it('propagates a network failure', async () => {
    fetchMock.mockRejectedValueOnce(new Error('network unreachable'));

    await expect(fetchWithTimeout('https://example.com', 'timed out')).rejects.toThrow('network unreachable');
  });

  it('throws the given message after a client-side timeout', async () => {
    vi.useFakeTimers();
    try {
      fetchMock.mockImplementationOnce((_url: string, options: { signal: AbortSignal }) => {
        return new Promise((_resolve, reject) => {
          options.signal.addEventListener('abort', () => {
            const abortError = new Error('The operation was aborted');
            abortError.name = 'AbortError';
            reject(abortError);
          });
        });
      });

      const resultPromise = fetchWithTimeout('https://example.com', 'PubMed request timed out.');
      const assertion = expect(resultPromise).rejects.toThrow('PubMed request timed out.');
      await vi.advanceTimersByTimeAsync(HTTP_CLIENT_TIMEOUT_MS);
      await assertion;
    } finally {
      vi.useRealTimers();
    }
  });
});
```

- [ ] **Step 3: Test ausführen, Fehlschlag bestätigen**

Run: `cd feed-service && npx vitest run src/httpClient.test.ts`
Expected: FAIL mit "Cannot find module './httpClient'"

- [ ] **Step 4: `httpClient.ts` implementieren**

```typescript
import { HTTP_CLIENT_TIMEOUT_MS } from './constants';

export async function fetchWithTimeout(url: string, timeoutMessage: string): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), HTTP_CLIENT_TIMEOUT_MS);
  try {
    return await fetch(url, { signal: controller.signal });
  } catch (error: unknown) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(timeoutMessage);
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}
```

- [ ] **Step 5: Test erneut ausführen, Erfolg bestätigen**

Run: `cd feed-service && npx vitest run src/httpClient.test.ts`
Expected: 3 Tests, alle grün.

- [ ] **Step 6: Fehlschlagenden Test für PubMed-URL-Bau und -Parsing schreiben**

`feed-service/src/pubmedClient.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  buildPubmedSearchTerm,
  buildPubmedEsearchUrl,
  buildPubmedEsummaryUrl,
  parsePubmedEsearchResponse,
  parsePubmedDate,
  parsePubmedEsummaryResponse,
  fetchPubmedItems,
} from './pubmedClient';

describe('buildPubmedSearchTerm', () => {
  it('builds a term filtered to clinical trials, guidelines, systematic reviews and meta-analyses since the given date', () => {
    const term = buildPubmedSearchTerm('2026-01-13');
    expect(term).toBe(
      '("ulcerative colitis"[Title/Abstract]) AND (Clinical Trial[pt] OR Guideline[pt] OR Systematic Review[pt] OR Meta-Analysis[pt]) AND ("2026/01/13"[Date - Publication] : "3000"[Date - Publication])'
    );
  });
});

describe('buildPubmedEsearchUrl', () => {
  it('builds the esearch URL with the expected fixed parameters', () => {
    const url = buildPubmedEsearchUrl('2026-01-13');
    expect(url.startsWith('https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?')).toBe(true);
    expect(url).toContain('db=pubmed');
    expect(url).toContain('retmode=json');
    expect(url).toContain('sort=pub+date');
  });
});

describe('buildPubmedEsummaryUrl', () => {
  it('joins pmids with commas (percent-encoded)', () => {
    const url = buildPubmedEsummaryUrl(['111', '222']);
    expect(url).toContain('id=111%2C222');
  });
});

describe('parsePubmedEsearchResponse', () => {
  it('extracts the id list', () => {
    expect(parsePubmedEsearchResponse({ esearchresult: { idlist: ['111', '222'] } })).toEqual(['111', '222']);
  });

  it('returns an empty array when idlist is missing', () => {
    expect(parsePubmedEsearchResponse({})).toEqual([]);
  });
});

describe('parsePubmedDate', () => {
  it('parses a full date', () => {
    expect(parsePubmedDate('2026 Jul 15')).toBe('2026-07-15');
  });

  it('parses a year and month only, defaulting the day to 01', () => {
    expect(parsePubmedDate('2026 Jul')).toBe('2026-07-01');
  });

  it('parses a year only, defaulting month and day to 01', () => {
    expect(parsePubmedDate('2026')).toBe('2026-01-01');
  });
});

describe('parsePubmedEsummaryResponse', () => {
  it('builds feed items from the summary result', () => {
    const items = parsePubmedEsummaryResponse({
      result: { uids: ['111'], '111': { uid: '111', title: 'A Trial', pubdate: '2026 Jul 15' } },
    });

    expect(items).toEqual([
      {
        id: 'pubmed:111',
        source: 'pubmed',
        category: 'studie',
        title: 'A Trial',
        summaryDe: '',
        publishedDate: '2026-07-15',
        url: 'https://pubmed.ncbi.nlm.nih.gov/111/',
      },
    ]);
  });

  it('skips entries missing a title or pubdate', () => {
    const items = parsePubmedEsummaryResponse({ result: { uids: ['111'], '111': { uid: '111' } } });
    expect(items).toEqual([]);
  });
});

const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockReset();
});

describe('fetchPubmedItems', () => {
  it('searches then summarizes and returns feed items', async () => {
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ esearchresult: { idlist: ['111'] } }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            result: { uids: ['111'], '111': { uid: '111', title: 'A Trial', pubdate: '2026 Jul 15' } },
          }),
      });

    const items = await fetchPubmedItems('2026-01-13');

    expect(items).toHaveLength(1);
    expect(items[0].id).toBe('pubmed:111');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('returns an empty array without calling esummary when there are no results', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ esearchresult: { idlist: [] } }),
    });

    const items = await fetchPubmedItems('2026-01-13');

    expect(items).toEqual([]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('throws when esearch responds with a non-ok status', async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 500, json: () => Promise.resolve({}) });

    await expect(fetchPubmedItems('2026-01-13')).rejects.toThrow('PubMed request failed (status 500)');
  });
});
```

- [ ] **Step 7: Test ausführen, Fehlschlag bestätigen**

Run: `cd feed-service && npx vitest run src/pubmedClient.test.ts`
Expected: FAIL mit "Cannot find module './pubmedClient'"

- [ ] **Step 8: `pubmedClient.ts` implementieren**

```typescript
import { fetchWithTimeout } from './httpClient';
import type { FeedItem } from './types';

const PUBMED_ESEARCH_URL = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi';
const PUBMED_ESUMMARY_URL = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi';
const PUBMED_RETMAX = 50;
const PUBMED_TIMEOUT_MESSAGE = 'PubMed request timed out.';

const MONTH_NAMES: Record<string, string> = {
  Jan: '01', Feb: '02', Mar: '03', Apr: '04', May: '05', Jun: '06',
  Jul: '07', Aug: '08', Sep: '09', Oct: '10', Nov: '11', Dec: '12',
};

export function buildPubmedSearchTerm(sinceDate: string): string {
  const sinceForPubmed = sinceDate.replace(/-/g, '/');
  return `("ulcerative colitis"[Title/Abstract]) AND (Clinical Trial[pt] OR Guideline[pt] OR Systematic Review[pt] OR Meta-Analysis[pt]) AND ("${sinceForPubmed}"[Date - Publication] : "3000"[Date - Publication])`;
}

export function buildPubmedEsearchUrl(sinceDate: string): string {
  const params = new URLSearchParams({
    db: 'pubmed',
    term: buildPubmedSearchTerm(sinceDate),
    retmode: 'json',
    retmax: String(PUBMED_RETMAX),
    sort: 'pub date',
  });
  return `${PUBMED_ESEARCH_URL}?${params.toString()}`;
}

export function buildPubmedEsummaryUrl(pmids: string[]): string {
  const params = new URLSearchParams({ db: 'pubmed', id: pmids.join(','), retmode: 'json' });
  return `${PUBMED_ESUMMARY_URL}?${params.toString()}`;
}

export function parsePubmedEsearchResponse(data: unknown): string[] {
  const response = data as { esearchresult?: { idlist?: string[] } };
  return response.esearchresult?.idlist ?? [];
}

export function parsePubmedDate(pubdate: string): string {
  const parts = pubdate.trim().split(/\s+/);
  const year = parts[0];
  const month = parts[1] && MONTH_NAMES[parts[1]] ? MONTH_NAMES[parts[1]] : '01';
  const dayRaw = parts[2] ?? '';
  const day = /^\d{1,2}$/.test(dayRaw) ? dayRaw.padStart(2, '0') : '01';
  return `${year}-${month}-${day}`;
}

interface PubmedEsummaryEntry {
  title?: string;
  pubdate?: string;
}

export function parsePubmedEsummaryResponse(data: unknown): FeedItem[] {
  const response = data as { result?: Record<string, unknown> };
  const result = response.result ?? {};
  const uids = (result.uids as string[] | undefined) ?? [];
  const items: FeedItem[] = [];
  for (const uid of uids) {
    const entry = result[uid] as PubmedEsummaryEntry | undefined;
    if (!entry?.title || !entry.pubdate) {
      continue;
    }
    items.push({
      id: `pubmed:${uid}`,
      source: 'pubmed',
      category: 'studie',
      title: entry.title,
      summaryDe: '',
      publishedDate: parsePubmedDate(entry.pubdate),
      url: `https://pubmed.ncbi.nlm.nih.gov/${uid}/`,
    });
  }
  return items;
}

async function fetchPubmedJson(url: string): Promise<unknown> {
  const response = await fetchWithTimeout(url, PUBMED_TIMEOUT_MESSAGE);
  if (!response.ok) {
    throw new Error(`PubMed request failed (status ${response.status})`);
  }
  return response.json();
}

export async function fetchPubmedItems(sinceDate: string): Promise<FeedItem[]> {
  const esearchData = await fetchPubmedJson(buildPubmedEsearchUrl(sinceDate));
  const pmids = parsePubmedEsearchResponse(esearchData);
  if (pmids.length === 0) {
    return [];
  }
  const esummaryData = await fetchPubmedJson(buildPubmedEsummaryUrl(pmids));
  return parsePubmedEsummaryResponse(esummaryData);
}
```

- [ ] **Step 9: Test erneut ausführen, Erfolg bestätigen**

Run: `cd feed-service && npx vitest run src/pubmedClient.test.ts`
Expected: 13 Tests, alle grün.

- [ ] **Step 10: Gesamte Test-Suite und TypeScript-Check**

Run: `cd feed-service && npm test && npx tsc --noEmit`
Expected: alle Tests grün (29 insgesamt), keine TypeScript-Fehler.

- [ ] **Step 11: Commit**

```bash
git add feed-service/src/constants.ts feed-service/src/httpClient.ts feed-service/src/httpClient.test.ts feed-service/src/pubmedClient.ts feed-service/src/pubmedClient.test.ts
git commit -m "feat: PubMed-Client fuer den News-Feed implementieren"
```

---

### Task 4: AWMF-Leitlinien-Client

**Files:**
- Create: `feed-service/src/awmfClient.ts`
- Test: `feed-service/src/awmfClient.test.ts`

**Interfaces:**
- Consumes: `fetchWithTimeout` (Task 3, `httpClient.ts`); `FeedItem` (Task 1, `types.ts`)
- Produces: `AWMF_WATCHED_GUIDELINES: AwmfGuideline[]`, `fetchAwmfItems(previousItems: FeedItem[]): Promise<FeedItem[]>` (`awmfClient.ts`) – von Task 8 (Orchestrator) verwendet

Die AWMF-Register-Detailseite (`https://register.awmf.org/de/leitlinien/detail/<nr>`) enthält die aktuelle Versionsnummer und das Veröffentlichungsdatum als Klartext auf der Seite (z. B. "Version 7.0" und ein Datum im Format "15.11.2025"). Da AWMF keine JSON-API bereitstellt, wird die HTML-Seite abgerufen und per regulärem Ausdruck ausgewertet – bewusst ohne HTML-Parser-Bibliothek (kein neues Paket, Spec-Vorgabe "keine unnötigen Abhängigkeiten"), da nur zwei feste, bekannte Muster gesucht werden.

**Hinweis für den Umsetzer:** Die genauen Text-/HTML-Muster auf der echten AWMF-Seite können von den hier angenommenen Mustern abweichen. Vor Abschluss dieser Task einmal die beiden echten Seiten (`021-009` und `073-027`) live abrufen und die Regex-Muster in `parseAwmfVersionInfo` bei Bedarf anpassen; die zugehörigen Tests entsprechend mit einem realistischen HTML-Ausschnitt aktualisieren. Die Fallback-Logik (Fehler beim Auslesen → alten Stand beibehalten, nicht abstürzen) bleibt in jedem Fall bestehen.

- [ ] **Step 1: Fehlschlagenden Test schreiben**

`feed-service/src/awmfClient.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AWMF_WATCHED_GUIDELINES, parseAwmfVersionInfo, fetchAwmfItems } from './awmfClient';
import type { FeedItem } from './types';

describe('AWMF_WATCHED_GUIDELINES', () => {
  it('contains exactly the two known guidelines', () => {
    expect(AWMF_WATCHED_GUIDELINES).toEqual([
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
    ]);
  });
});

describe('parseAwmfVersionInfo', () => {
  it('extracts version and publication date from the guideline page HTML', () => {
    const html = '<div class="version">Version 7.0</div><div class="date">15.11.2025</div>';
    expect(parseAwmfVersionInfo(html)).toEqual({ version: '7.0', publishedDate: '2025-11-15' });
  });

  it('returns null when the version cannot be found', () => {
    expect(parseAwmfVersionInfo('<div>unexpected page structure</div>')).toBeNull();
  });
});

const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockReset();
});

describe('fetchAwmfItems', () => {
  it('returns a feed item when a guideline has a newer version than previously known', async () => {
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: () => Promise.resolve('<div class="version">Version 7.0</div><div class="date">15.11.2025</div>'),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: () => Promise.resolve('<div class="version">Version 2.1</div><div class="date">01.02.2025</div>'),
      });

    const previousItems: FeedItem[] = [
      {
        id: 'awmf:021-009:v6.2',
        source: 'awmf',
        category: 'leitlinie',
        title: 'S3-Leitlinie Colitis ulcerosa',
        summaryDe: 'Alte Version.',
        publishedDate: '2025-02-01',
        url: 'https://register.awmf.org/de/leitlinien/detail/021-009',
      },
    ];

    const items = await fetchAwmfItems(previousItems);

    expect(items).toHaveLength(2);
    expect(items[0].id).toBe('awmf:021-009:v7.0');
    expect(items[1].id).toBe('awmf:073-027:v2.1');
  });

  it('skips a guideline whose version is already known', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: () => Promise.resolve('<div class="version">Version 7.0</div><div class="date">15.11.2025</div>'),
    });
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: () => Promise.resolve('<div class="version">Version 2.1</div><div class="date">01.02.2025</div>'),
    });

    const previousItems: FeedItem[] = [
      {
        id: 'awmf:021-009:v7.0',
        source: 'awmf',
        category: 'leitlinie',
        title: 'S3-Leitlinie Colitis ulcerosa',
        summaryDe: 'Bereits bekannt.',
        publishedDate: '2025-11-15',
        url: 'https://register.awmf.org/de/leitlinien/detail/021-009',
      },
    ];

    const items = await fetchAwmfItems(previousItems);

    expect(items.map((item) => item.id)).toEqual(['awmf:073-027:v2.1']);
  });

  it('keeps processing the second guideline when the first fails to parse', async () => {
    fetchMock
      .mockResolvedValueOnce({ ok: true, status: 200, text: () => Promise.resolve('<div>broken page</div>') })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: () => Promise.resolve('<div class="version">Version 2.1</div><div class="date">01.02.2025</div>'),
      });

    const items = await fetchAwmfItems([]);

    expect(items.map((item) => item.id)).toEqual(['awmf:073-027:v2.1']);
  });
});
```

- [ ] **Step 2: Test ausführen, Fehlschlag bestätigen**

Run: `cd feed-service && npx vitest run src/awmfClient.test.ts`
Expected: FAIL mit "Cannot find module './awmfClient'"

- [ ] **Step 3: `awmfClient.ts` implementieren**

```typescript
import { fetchWithTimeout } from './httpClient';
import type { FeedItem } from './types';

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
```

- [ ] **Step 4: Test erneut ausführen, Erfolg bestätigen**

Run: `cd feed-service && npx vitest run src/awmfClient.test.ts`
Expected: 6 Tests, alle grün.

- [ ] **Step 5: Gesamte Test-Suite und TypeScript-Check**

Run: `cd feed-service && npm test && npx tsc --noEmit`
Expected: alle Tests grün (35 insgesamt), keine TypeScript-Fehler.

- [ ] **Step 6: Commit**

```bash
git add feed-service/src/awmfClient.ts feed-service/src/awmfClient.test.ts
git commit -m "feat: AWMF-Leitlinien-Client fuer den News-Feed implementieren"
```

---

### Task 5: FDA- und EMA-Client

**Files:**
- Create: `feed-service/src/fdaClient.ts`
- Test: `feed-service/src/fdaClient.test.ts`
- Create: `feed-service/src/emaClient.ts`
- Test: `feed-service/src/emaClient.test.ts`

**Interfaces:**
- Consumes: `fetchWithTimeout` (Task 3, `httpClient.ts`); `FeedItem` (Task 1, `types.ts`); `WatchedDrug` (Task 1, `drugWatchlist.ts`)
- Produces: `fetchFdaItems(watchlist: WatchedDrug[], previousItems: FeedItem[]): Promise<FeedItem[]>` (`fdaClient.ts`) – von Task 8 verwendet
- Produces: `fetchEmaItems(watchlist: WatchedDrug[], previousItems: FeedItem[]): Promise<FeedItem[]>` (`emaClient.ts`) – von Task 8 verwendet

Beide Clients bekommen die Wirkstoffliste als Parameter (nicht direkt importiert), damit sie in Tests mit einer kleinen, kontrollierten Liste statt der vollen 16-Wirkstoffe-Liste geprüft werden können. Beide bekommen außerdem `previousItems`, damit ein bereits veröffentlichter Treffer nicht jede Woche erneut an die Claude-Zusammenfassung (Task 6) geschickt wird – dieselbe Idee wie beim AWMF-Client aus Task 4.

**Hinweis für den Umsetzer (wie in Task 4):** Die genaue Antwortstruktur von `api.fda.gov/drug/drugsfda.json` und des EMA-News-RSS-Feeds sollte vor Abschluss dieser Task einmal live geprüft werden. Beide Parser sind unten als vollständige, lauffähige Ausgangsimplementierung spezifiziert; weicht die reale Struktur ab, Parser und Tests entsprechend anpassen. Die Grundregel bleibt: ein Parsing-Fehler bei einem einzelnen Wirkstoff/Item wird geloggt und übersprungen, nicht die ganze Quelle zum Absturz gebracht.

- [ ] **Step 1: Fehlschlagenden Test für den FDA-Client schreiben**

`feed-service/src/fdaClient.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { buildFdaSearchUrl, parseFdaResponse, fetchFdaItems } from './fdaClient';
import type { FeedItem } from './types';
import type { WatchedDrug } from './drugWatchlist';

const UPADACITINIB: WatchedDrug = { germanName: 'Upadacitinib', englishName: 'Upadacitinib' };

describe('buildFdaSearchUrl', () => {
  it('builds a search URL for the uppercased active ingredient', () => {
    const url = buildFdaSearchUrl('Upadacitinib');
    expect(url.startsWith('https://api.fda.gov/drug/drugsfda.json?')).toBe(true);
    expect(url).toContain(encodeURIComponent('products.active_ingredients.name:"UPADACITINIB"'));
  });
});

describe('parseFdaResponse', () => {
  it('picks the most recent submission and builds a feed item', () => {
    const data = {
      results: [
        {
          products: [{ brand_name: 'Rinvoq' }],
          submissions: [
            { submission_status_date: '20250101', submission_type: 'ORIG' },
            { submission_status_date: '20260301', submission_type: 'SUPPL' },
          ],
        },
      ],
    };

    expect(parseFdaResponse(data, UPADACITINIB)).toEqual({
      id: 'fda:upadacitinib:2026-03-01',
      source: 'fda',
      category: 'zulassung',
      title: 'Upadacitinib (Rinvoq): SUPPL bei der FDA',
      summaryDe: '',
      publishedDate: '2026-03-01',
      url: 'https://www.accessdata.fda.gov/scripts/cder/daf/index.cfm',
    });
  });

  it('returns null when there are no results', () => {
    expect(parseFdaResponse({ results: [] }, UPADACITINIB)).toBeNull();
  });

  it('returns null when no submission has a status date', () => {
    const data = { results: [{ products: [], submissions: [{ submission_type: 'ORIG' }] }] };
    expect(parseFdaResponse(data, UPADACITINIB)).toBeNull();
  });
});

const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockReset();
});

describe('fetchFdaItems', () => {
  it('collects new items across the watchlist', async () => {
    const watchlist: WatchedDrug[] = [
      { germanName: 'Infliximab', englishName: 'Infliximab' },
      { germanName: 'Vedolizumab', englishName: 'Vedolizumab' },
    ];

    fetchMock
      .mockResolvedValueOnce({ ok: false, status: 404, json: () => Promise.resolve({}) })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            results: [
              {
                products: [{ brand_name: 'Entyvio' }],
                submissions: [{ submission_status_date: '20260101', submission_type: 'SUPPL' }],
              },
            ],
          }),
      });

    const items = await fetchFdaItems(watchlist, []);

    expect(items).toEqual([
      {
        id: 'fda:vedolizumab:2026-01-01',
        source: 'fda',
        category: 'zulassung',
        title: 'Vedolizumab (Entyvio): SUPPL bei der FDA',
        summaryDe: '',
        publishedDate: '2026-01-01',
        url: 'https://www.accessdata.fda.gov/scripts/cder/daf/index.cfm',
      },
    ]);
  });

  it('skips an item already present in previousItems', async () => {
    const watchlist: WatchedDrug[] = [{ germanName: 'Vedolizumab', englishName: 'Vedolizumab' }];
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          results: [
            {
              products: [{ brand_name: 'Entyvio' }],
              submissions: [{ submission_status_date: '20260101', submission_type: 'SUPPL' }],
            },
          ],
        }),
    });

    const previousItems: FeedItem[] = [
      {
        id: 'fda:vedolizumab:2026-01-01',
        source: 'fda',
        category: 'zulassung',
        title: 'Vedolizumab (Entyvio): SUPPL bei der FDA',
        summaryDe: 'Bereits bekannt.',
        publishedDate: '2026-01-01',
        url: 'https://www.accessdata.fda.gov/scripts/cder/daf/index.cfm',
      },
    ];

    expect(await fetchFdaItems(watchlist, previousItems)).toEqual([]);
  });

  it('continues with the next drug after a request failure', async () => {
    const watchlist: WatchedDrug[] = [
      { germanName: 'Infliximab', englishName: 'Infliximab' },
      { germanName: 'Vedolizumab', englishName: 'Vedolizumab' },
    ];
    fetchMock.mockRejectedValueOnce(new Error('network unreachable')).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          results: [
            {
              products: [{ brand_name: 'Entyvio' }],
              submissions: [{ submission_status_date: '20260101', submission_type: 'SUPPL' }],
            },
          ],
        }),
    });

    const items = await fetchFdaItems(watchlist, []);

    expect(items.map((item) => item.id)).toEqual(['fda:vedolizumab:2026-01-01']);
  });
});
```

- [ ] **Step 2: Test ausführen, Fehlschlag bestätigen**

Run: `cd feed-service && npx vitest run src/fdaClient.test.ts`
Expected: FAIL mit "Cannot find module './fdaClient'"

- [ ] **Step 3: `fdaClient.ts` implementieren**

```typescript
import { fetchWithTimeout } from './httpClient';
import type { FeedItem } from './types';
import type { WatchedDrug } from './drugWatchlist';

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
```

- [ ] **Step 4: Test erneut ausführen, Erfolg bestätigen**

Run: `cd feed-service && npx vitest run src/fdaClient.test.ts`
Expected: 7 Tests, alle grün.

- [ ] **Step 5: Fehlschlagenden Test für den EMA-Client schreiben**

`feed-service/src/emaClient.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { parseEmaRssItems, buildEmaFeedItems, fetchEmaItems } from './emaClient';
import type { FeedItem } from './types';
import type { WatchedDrug } from './drugWatchlist';

const WATCHLIST: WatchedDrug[] = [{ germanName: 'Vedolizumab', englishName: 'Vedolizumab' }];

const SAMPLE_RSS = `<?xml version="1.0"?>
<rss><channel>
<item>
<title>EMA recommends extension of indication for Vedolizumab</title>
<link>https://www.ema.europa.eu/en/news/vedolizumab-update</link>
<description>The EMA has updated the label for Vedolizumab.</description>
<pubDate>Mon, 01 Mar 2026 10:00:00 GMT</pubDate>
</item>
<item>
<title>Unrelated announcement</title>
<link>https://www.ema.europa.eu/en/news/unrelated</link>
<description>Nothing about the watchlist here.</description>
<pubDate>Mon, 01 Mar 2026 10:00:00 GMT</pubDate>
</item>
</channel></rss>`;

describe('parseEmaRssItems', () => {
  it('extracts title, link, description and pubDate for every item', () => {
    const items = parseEmaRssItems(SAMPLE_RSS);
    expect(items).toHaveLength(2);
    expect(items[0]).toEqual({
      title: 'EMA recommends extension of indication for Vedolizumab',
      link: 'https://www.ema.europa.eu/en/news/vedolizumab-update',
      description: 'The EMA has updated the label for Vedolizumab.',
      pubDate: 'Mon, 01 Mar 2026 10:00:00 GMT',
    });
  });
});

describe('buildEmaFeedItems', () => {
  it('keeps only items matching a watched drug and builds feed items', () => {
    const items = buildEmaFeedItems(SAMPLE_RSS, WATCHLIST);

    expect(items).toEqual([
      {
        id: 'ema:https-www-ema-europa-eu-en-news-vedolizumab-update',
        source: 'ema',
        category: 'zulassung',
        title: 'EMA recommends extension of indication for Vedolizumab',
        summaryDe: '',
        publishedDate: '2026-03-01',
        url: 'https://www.ema.europa.eu/en/news/vedolizumab-update',
      },
    ]);
  });

  it('excludes an item already present in previousItems', () => {
    const previousItems: FeedItem[] = [
      {
        id: 'ema:https-www-ema-europa-eu-en-news-vedolizumab-update',
        source: 'ema',
        category: 'zulassung',
        title: 'EMA recommends extension of indication for Vedolizumab',
        summaryDe: 'Bereits bekannt.',
        publishedDate: '2026-03-01',
        url: 'https://www.ema.europa.eu/en/news/vedolizumab-update',
      },
    ];

    expect(buildEmaFeedItems(SAMPLE_RSS, WATCHLIST, previousItems)).toEqual([]);
  });
});

const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockReset();
});

describe('fetchEmaItems', () => {
  it('fetches the RSS feed and returns matching items', async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, status: 200, text: () => Promise.resolve(SAMPLE_RSS) });

    const items = await fetchEmaItems(WATCHLIST, []);

    expect(items).toHaveLength(1);
    expect(items[0].source).toBe('ema');
  });

  it('throws when the RSS request is not ok', async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 500, text: () => Promise.resolve('') });

    await expect(fetchEmaItems(WATCHLIST, [])).rejects.toThrow('EMA request failed (status 500)');
  });
});
```

- [ ] **Step 6: Test ausführen, Fehlschlag bestätigen**

Run: `cd feed-service && npx vitest run src/emaClient.test.ts`
Expected: FAIL mit "Cannot find module './emaClient'"

- [ ] **Step 7: `emaClient.ts` implementieren**

```typescript
import { fetchWithTimeout } from './httpClient';
import type { FeedItem } from './types';
import type { WatchedDrug } from './drugWatchlist';

const EMA_RSS_URL = 'https://www.ema.europa.eu/en/rss.xml';
const EMA_TIMEOUT_MESSAGE = 'EMA request timed out.';

interface RssItem {
  title: string;
  link: string;
  description: string;
  pubDate: string;
}

function extractTag(block: string, tag: string): string {
  const match = block.match(new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`));
  if (!match) {
    return '';
  }
  return match[1]
    .replace(/^<!\[CDATA\[/, '')
    .replace(/\]\]>$/, '')
    .trim();
}

export function parseEmaRssItems(xml: string): RssItem[] {
  const itemBlocks = xml.match(/<item>[\s\S]*?<\/item>/g) ?? [];
  return itemBlocks.map((block) => ({
    title: extractTag(block, 'title'),
    link: extractTag(block, 'link'),
    description: extractTag(block, 'description'),
    pubDate: extractTag(block, 'pubDate'),
  }));
}

function matchesWatchlist(item: RssItem, watchlist: WatchedDrug[]): boolean {
  const haystack = `${item.title} ${item.description}`.toLowerCase();
  return watchlist.some((drug) => haystack.includes(drug.englishName.toLowerCase()));
}

function slugifyForId(value: string): string {
  return value
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()
    .slice(0, 60);
}

export function buildEmaFeedItems(xml: string, watchlist: WatchedDrug[], previousItems: FeedItem[] = []): FeedItem[] {
  const items = parseEmaRssItems(xml);
  const result: FeedItem[] = [];

  for (const item of items) {
    if (!item.pubDate || !item.link || !matchesWatchlist(item, watchlist)) {
      continue;
    }
    const parsedDate = new Date(item.pubDate);
    if (Number.isNaN(parsedDate.getTime())) {
      continue;
    }
    const id = `ema:${slugifyForId(item.link)}`;
    if (previousItems.some((existing) => existing.id === id)) {
      continue;
    }
    result.push({
      id,
      source: 'ema',
      category: 'zulassung',
      title: item.title,
      summaryDe: '',
      publishedDate: parsedDate.toISOString().slice(0, 10),
      url: item.link,
    });
  }

  return result;
}

export async function fetchEmaItems(watchlist: WatchedDrug[], previousItems: FeedItem[]): Promise<FeedItem[]> {
  const response = await fetchWithTimeout(EMA_RSS_URL, EMA_TIMEOUT_MESSAGE);
  if (!response.ok) {
    throw new Error(`EMA request failed (status ${response.status})`);
  }
  const xml = await response.text();
  return buildEmaFeedItems(xml, watchlist, previousItems);
}
```

- [ ] **Step 8: Test erneut ausführen, Erfolg bestätigen**

Run: `cd feed-service && npx vitest run src/emaClient.test.ts`
Expected: 5 Tests, alle grün.

- [ ] **Step 9: Gesamte Test-Suite und TypeScript-Check**

Run: `cd feed-service && npm test && npx tsc --noEmit`
Expected: alle Tests grün (47 insgesamt), keine TypeScript-Fehler.

- [ ] **Step 10: Commit**

```bash
git add feed-service/src/fdaClient.ts feed-service/src/fdaClient.test.ts feed-service/src/emaClient.ts feed-service/src/emaClient.test.ts
git commit -m "feat: FDA- und EMA-Client fuer den News-Feed implementieren"
```

---

### Task 6: Deutsche Kurzzusammenfassung (Claude API)

**Files:**
- Modify: `feed-service/src/httpClient.ts` (nimmt jetzt optional `RequestInit` entgegen, damit auch POST-Aufrufe mit Timeout laufen)
- Modify: `feed-service/src/httpClient.test.ts` (ein zusätzlicher Testfall für die neue POST-Fähigkeit)
- Create: `feed-service/src/summarize.ts`
- Test: `feed-service/src/summarize.test.ts`

**Interfaces:**
- Consumes: `fetchWithTimeout` (Task 3, erweitert in dieser Task); `FeedItem` (Task 1, `types.ts`)
- Produces: `summarizeNewItems(items: FeedItem[], apiKey: string): Promise<FeedItem[]>` (`summarize.ts`) – von Task 8 (Orchestrator) verwendet. Gibt nur die Items zurück, deren Zusammenfassung erfolgreich war (fehlgeschlagene werden übersprungen, Spec §5.1).

- [ ] **Step 1: `fetchWithTimeout` um optionales `RequestInit` erweitern**

`feed-service/src/httpClient.ts` – bestehende Datei aus Task 3, komplett ersetzen:

```typescript
import { HTTP_CLIENT_TIMEOUT_MS } from './constants';

export async function fetchWithTimeout(
  url: string,
  timeoutMessage: string,
  init: RequestInit = {}
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), HTTP_CLIENT_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (error: unknown) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(timeoutMessage);
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}
```

- [ ] **Step 2: Test für die POST-Fähigkeit ergänzen**

An `feed-service/src/httpClient.test.ts` (aus Task 3) folgenden Testfall am Ende des `describe('fetchWithTimeout', ...)`-Blocks hinzufügen (Datei enthält bereits 3 Tests, dieser ist der vierte):

```typescript
  it('forwards method, headers and body from the given init', async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, status: 200 });

    await fetchWithTimeout('https://example.com', 'timed out', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{"a":1}',
    });

    expect(fetchMock).toHaveBeenCalledWith(
      'https://example.com',
      expect.objectContaining({ method: 'POST', headers: { 'content-type': 'application/json' }, body: '{"a":1}' })
    );
  });
```

- [ ] **Step 3: Test ausführen, Erfolg bestätigen**

Run: `cd feed-service && npx vitest run src/httpClient.test.ts`
Expected: 4 Tests, alle grün.

- [ ] **Step 4: Fehlschlagenden Test für `summarize.ts` schreiben**

`feed-service/src/summarize.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { buildSummaryPrompt, parseAnthropicSummary, summarizeItem, summarizeNewItems } from './summarize';
import type { FeedItem } from './types';

function makeItem(overrides: Partial<FeedItem> = {}): FeedItem {
  return {
    id: 'pubmed:1',
    source: 'pubmed',
    category: 'studie',
    title: 'A new trial on ulcerative colitis treatment',
    summaryDe: '',
    publishedDate: '2026-07-01',
    url: 'https://pubmed.ncbi.nlm.nih.gov/1/',
    ...overrides,
  };
}

describe('buildSummaryPrompt', () => {
  it('includes title, source, category and link', () => {
    const prompt = buildSummaryPrompt(makeItem());
    expect(prompt).toContain('A new trial on ulcerative colitis treatment');
    expect(prompt).toContain('pubmed');
    expect(prompt).toContain('studie');
    expect(prompt).toContain('https://pubmed.ncbi.nlm.nih.gov/1/');
  });
});

describe('parseAnthropicSummary', () => {
  it('extracts and trims the text block', () => {
    expect(parseAnthropicSummary({ content: [{ type: 'text', text: '  Kurze Zusammenfassung.  ' }] })).toBe(
      'Kurze Zusammenfassung.'
    );
  });

  it('throws when there is no text block', () => {
    expect(() => parseAnthropicSummary({ content: [] })).toThrow(
      'Anthropic response did not contain a text block.'
    );
  });
});

const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockReset();
});

describe('summarizeItem', () => {
  it('posts the prompt and returns the summary text', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ content: [{ type: 'text', text: 'Kurze Zusammenfassung.' }] }),
    });

    const summary = await summarizeItem(makeItem(), 'test-key');

    expect(summary).toBe('Kurze Zusammenfassung.');
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.anthropic.com/v1/messages',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ 'x-api-key': 'test-key', 'anthropic-version': '2023-06-01' }),
      })
    );
  });

  it('throws when the request is not ok', async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 500, json: () => Promise.resolve({}) });

    await expect(summarizeItem(makeItem(), 'test-key')).rejects.toThrow('Anthropic request failed (status 500)');
  });
});

describe('summarizeNewItems', () => {
  it('summarizes every item and fills in summaryDe', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ content: [{ type: 'text', text: 'Kurze Zusammenfassung.' }] }),
    });

    const items = await summarizeNewItems([makeItem({ id: 'pubmed:1' }), makeItem({ id: 'pubmed:2' })], 'test-key');

    expect(items).toHaveLength(2);
    expect(items.every((item) => item.summaryDe === 'Kurze Zusammenfassung.')).toBe(true);
  });

  it('skips an item whose summarization fails and keeps the others', async () => {
    fetchMock
      .mockResolvedValueOnce({ ok: false, status: 500, json: () => Promise.resolve({}) })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ content: [{ type: 'text', text: 'Kurze Zusammenfassung.' }] }),
      });

    const items = await summarizeNewItems([makeItem({ id: 'pubmed:1' }), makeItem({ id: 'pubmed:2' })], 'test-key');

    expect(items.map((item) => item.id)).toEqual(['pubmed:2']);
  });
});
```

- [ ] **Step 5: Test ausführen, Fehlschlag bestätigen**

Run: `cd feed-service && npx vitest run src/summarize.test.ts`
Expected: FAIL mit "Cannot find module './summarize'"

- [ ] **Step 6: `summarize.ts` implementieren**

```typescript
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
```

- [ ] **Step 7: Test erneut ausführen, Erfolg bestätigen**

Run: `cd feed-service && npx vitest run src/summarize.test.ts`
Expected: 7 Tests, alle grün.

- [ ] **Step 8: Gesamte Test-Suite und TypeScript-Check**

Run: `cd feed-service && npm test && npx tsc --noEmit`
Expected: alle Tests grün (55 insgesamt), keine TypeScript-Fehler.

- [ ] **Step 9: Commit**

```bash
git add feed-service/src/httpClient.ts feed-service/src/httpClient.test.ts feed-service/src/summarize.ts feed-service/src/summarize.test.ts
git commit -m "feat: deutsche Kurzzusammenfassung per Claude API implementieren"
```

---

### Task 7: Veröffentlichung (GitHub Contents API)

**Files:**
- Create: `feed-service/src/publish.ts`
- Test: `feed-service/src/publish.test.ts`

**Interfaces:**
- Consumes: `fetchWithTimeout` (Task 3/6, `httpClient.ts`); `FeedPublication` (Task 1, `types.ts`)
- Produces: `FeedFileState { publication: FeedPublication | null; sha: string | null }`, `fetchCurrentFeedFile(token: string): Promise<FeedFileState>`, `hasFeedChanged(previous: FeedPublication | null, next: FeedPublication): boolean`, `publishFeed(publication: FeedPublication, previousSha: string | null, token: string): Promise<void>` (alle aus `publish.ts`) – von Task 8 (Orchestrator) verwendet

- [ ] **Step 1: Fehlschlagenden Test schreiben**

`feed-service/src/publish.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchCurrentFeedFile, hasFeedChanged, publishFeed } from './publish';
import type { FeedPublication } from './types';

const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockReset();
});

describe('fetchCurrentFeedFile', () => {
  it('decodes the base64 content and returns publication plus sha', async () => {
    const publication: FeedPublication = { generatedAt: '2026-07-08T05:00:00.000Z', items: [] };
    const encoded = Buffer.from(JSON.stringify(publication)).toString('base64');
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ content: encoded, sha: 'abc123' }),
    });

    expect(await fetchCurrentFeedFile('token')).toEqual({ publication, sha: 'abc123' });
  });

  it('returns null publication and sha when the file does not exist yet', async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 404, json: () => Promise.resolve({}) });

    expect(await fetchCurrentFeedFile('token')).toEqual({ publication: null, sha: null });
  });

  it('throws on an unexpected error status', async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 500, json: () => Promise.resolve({}) });

    await expect(fetchCurrentFeedFile('token')).rejects.toThrow('GitHub contents GET failed (status 500)');
  });
});

describe('hasFeedChanged', () => {
  const publication: FeedPublication = {
    generatedAt: '2026-07-15T05:00:00.000Z',
    items: [
      {
        id: 'pubmed:1',
        source: 'pubmed',
        category: 'studie',
        title: 'A',
        summaryDe: 'B',
        publishedDate: '2026-07-01',
        url: 'https://example.com',
      },
    ],
  };

  it('is true when there is no previous publication', () => {
    expect(hasFeedChanged(null, publication)).toBe(true);
  });

  it('is false when the items are identical (ignoring generatedAt)', () => {
    const previous: FeedPublication = { ...publication, generatedAt: '2026-07-08T05:00:00.000Z' };
    expect(hasFeedChanged(previous, publication)).toBe(false);
  });

  it('is true when the items differ', () => {
    const previous: FeedPublication = { ...publication, items: [] };
    expect(hasFeedChanged(previous, publication)).toBe(true);
  });
});

describe('publishFeed', () => {
  it('PUTs base64-encoded content with the previous sha when updating', async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, status: 200, json: () => Promise.resolve({}) });
    const publication: FeedPublication = { generatedAt: '2026-07-15T05:00:00.000Z', items: [] };

    await publishFeed(publication, 'previous-sha', 'token');

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.github.com/repos/Kettenhund46/colitis-app-feed/contents/feed.json',
      expect.objectContaining({ method: 'PUT' })
    );
    const [, options] = fetchMock.mock.calls[0];
    const body = JSON.parse(options.body as string);
    expect(body.sha).toBe('previous-sha');
    expect(JSON.parse(Buffer.from(body.content, 'base64').toString('utf-8'))).toEqual(publication);
  });

  it('omits sha on first publish', async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, status: 200, json: () => Promise.resolve({}) });
    const publication: FeedPublication = { generatedAt: '2026-07-15T05:00:00.000Z', items: [] };

    await publishFeed(publication, null, 'token');

    const [, options] = fetchMock.mock.calls[0];
    const body = JSON.parse(options.body as string);
    expect(body.sha).toBeUndefined();
  });

  it('throws when the PUT fails', async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 409, json: () => Promise.resolve({}) });

    await expect(
      publishFeed({ generatedAt: '2026-07-15T05:00:00.000Z', items: [] }, 'sha', 'token')
    ).rejects.toThrow('GitHub contents PUT failed (status 409)');
  });
});
```

- [ ] **Step 2: Test ausführen, Fehlschlag bestätigen**

Run: `cd feed-service && npx vitest run src/publish.test.ts`
Expected: FAIL mit "Cannot find module './publish'"

- [ ] **Step 3: `publish.ts` implementieren**

```typescript
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
```

- [ ] **Step 4: Test erneut ausführen, Erfolg bestätigen**

Run: `cd feed-service && npx vitest run src/publish.test.ts`
Expected: 9 Tests, alle grün.

- [ ] **Step 5: Gesamte Test-Suite und TypeScript-Check**

Run: `cd feed-service && npm test && npx tsc --noEmit`
Expected: alle Tests grün (64 insgesamt), keine TypeScript-Fehler.

- [ ] **Step 6: Commit**

```bash
git add feed-service/src/publish.ts feed-service/src/publish.test.ts
git commit -m "feat: Veroeffentlichung des News-Feeds ueber die GitHub Contents API implementieren"
```

---

### Task 8: Orchestrator, Einstiegspunkt und GitHub-Actions-Workflow

**Files:**
- Create: `feed-service/src/runFeedUpdate.ts`
- Test: `feed-service/src/runFeedUpdate.test.ts`
- Create: `feed-service/src/index.ts`
- Create: `.github/workflows/feed-update.yml`
- Create: `feed-service/README.md`

**Interfaces:**
- Consumes: alles aus Tasks 1–7 (`FeedItem`, `FeedPublication`, `DRUG_WATCHLIST`, `computePubmedSearchSinceDate`, `mergeAndFilterItems`, `buildPublication`, `fetchPubmedItems`, `fetchAwmfItems`, `fetchFdaItems`, `fetchEmaItems`, `summarizeNewItems`, `fetchCurrentFeedFile`, `hasFeedChanged`, `publishFeed`)
- Produces: `FeedUpdateDeps`, `FeedUpdateResult`, `runFeedUpdate(deps: FeedUpdateDeps, env: { anthropicApiKey: string; publishToken: string }, now: Date): Promise<FeedUpdateResult>` (`runFeedUpdate.ts`) – von `index.ts` verwendet, keine weiteren Konsumenten in diesem Plan.

- [ ] **Step 1: Fehlschlagenden Test für den Orchestrator schreiben**

`feed-service/src/runFeedUpdate.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { runFeedUpdate } from './runFeedUpdate';
import type { FeedItem, FeedPublication } from './types';

const NOW = new Date('2026-07-15T05:00:00.000Z');
const ENV = { anthropicApiKey: 'anthropic-key', publishToken: 'publish-token' };

function makeItem(overrides: Partial<FeedItem> = {}): FeedItem {
  return {
    id: 'pubmed:1',
    source: 'pubmed',
    category: 'studie',
    title: 'Title',
    summaryDe: '',
    publishedDate: '2026-07-10',
    url: 'https://example.com',
    ...overrides,
  };
}

function makeDeps(overrides: Record<string, unknown> = {}) {
  return {
    fetchCurrentFeedFile: vi.fn().mockResolvedValue({ publication: null, sha: null }),
    fetchPubmedItems: vi.fn().mockResolvedValue([]),
    fetchAwmfItems: vi.fn().mockResolvedValue([]),
    fetchFdaItems: vi.fn().mockResolvedValue([]),
    fetchEmaItems: vi.fn().mockResolvedValue([]),
    summarizeNewItems: vi.fn().mockImplementation(async (items: FeedItem[]) => items),
    publishFeed: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe('runFeedUpdate', () => {
  it('publishes new items collected from all sources', async () => {
    const deps = makeDeps({ fetchPubmedItems: vi.fn().mockResolvedValue([makeItem({ id: 'pubmed:1' })]) });

    const result = await runFeedUpdate(deps as never, ENV, NOW);

    expect(result.published).toBe(true);
    expect(result.publishedItemCount).toBe(1);
    expect(result.failedSources).toEqual([]);
    expect(deps.publishFeed).toHaveBeenCalledTimes(1);
  });

  it('does not call publishFeed when nothing changed', async () => {
    const existing: FeedPublication = { generatedAt: '2026-07-08T05:00:00.000Z', items: [] };
    const deps = makeDeps({ fetchCurrentFeedFile: vi.fn().mockResolvedValue({ publication: existing, sha: 'sha-1' }) });

    const result = await runFeedUpdate(deps as never, ENV, NOW);

    expect(result.published).toBe(false);
    expect(deps.publishFeed).not.toHaveBeenCalled();
  });

  it('continues when one source fails and records it', async () => {
    const deps = makeDeps({
      fetchAwmfItems: vi.fn().mockRejectedValue(new Error('boom')),
      fetchPubmedItems: vi.fn().mockResolvedValue([makeItem({ id: 'pubmed:1' })]),
    });

    const result = await runFeedUpdate(deps as never, ENV, NOW);

    expect(result.failedSources).toEqual(['awmf']);
    expect(result.published).toBe(true);
  });

  it('throws when all sources fail and does not publish', async () => {
    const deps = makeDeps({
      fetchPubmedItems: vi.fn().mockRejectedValue(new Error('a')),
      fetchAwmfItems: vi.fn().mockRejectedValue(new Error('b')),
      fetchFdaItems: vi.fn().mockRejectedValue(new Error('c')),
      fetchEmaItems: vi.fn().mockRejectedValue(new Error('d')),
    });

    await expect(runFeedUpdate(deps as never, ENV, NOW)).rejects.toThrow('All feed sources failed.');
    expect(deps.publishFeed).not.toHaveBeenCalled();
  });

  it('does not re-summarize a pubmed item already present in the previous publication (overlap window)', async () => {
    const existingItem = makeItem({ id: 'pubmed:1', summaryDe: 'Bereits bekannt.' });
    const existing: FeedPublication = { generatedAt: '2026-07-08T05:00:00.000Z', items: [existingItem] };
    const deps = makeDeps({
      fetchCurrentFeedFile: vi.fn().mockResolvedValue({ publication: existing, sha: 'sha-1' }),
      fetchPubmedItems: vi.fn().mockResolvedValue([makeItem({ id: 'pubmed:1', summaryDe: '' })]),
    });

    await runFeedUpdate(deps as never, ENV, NOW);

    expect(deps.summarizeNewItems).toHaveBeenCalledWith([], ENV.anthropicApiKey);
  });
});
```

- [ ] **Step 2: Test ausführen, Fehlschlag bestätigen**

Run: `cd feed-service && npx vitest run src/runFeedUpdate.test.ts`
Expected: FAIL mit "Cannot find module './runFeedUpdate'"

- [ ] **Step 3: `runFeedUpdate.ts` implementieren**

```typescript
import type { FeedItem, FeedPublication } from './types';
import type { FeedFileState } from './publish';
import type { WatchedDrug } from './drugWatchlist';
import { DRUG_WATCHLIST } from './drugWatchlist';
import { computePubmedSearchSinceDate } from './dateWindow';
import { mergeAndFilterItems, buildPublication } from './mergeAndWindow';
import { hasFeedChanged } from './publish';

export interface FeedUpdateDeps {
  fetchCurrentFeedFile: (token: string) => Promise<FeedFileState>;
  fetchPubmedItems: (sinceDate: string) => Promise<FeedItem[]>;
  fetchAwmfItems: (previousItems: FeedItem[]) => Promise<FeedItem[]>;
  fetchFdaItems: (watchlist: WatchedDrug[], previousItems: FeedItem[]) => Promise<FeedItem[]>;
  fetchEmaItems: (watchlist: WatchedDrug[], previousItems: FeedItem[]) => Promise<FeedItem[]>;
  summarizeNewItems: (items: FeedItem[], apiKey: string) => Promise<FeedItem[]>;
  publishFeed: (publication: FeedPublication, previousSha: string | null, token: string) => Promise<void>;
}

export interface FeedUpdateResult {
  publishedItemCount: number;
  failedSources: string[];
  published: boolean;
}

export async function runFeedUpdate(
  deps: FeedUpdateDeps,
  env: { anthropicApiKey: string; publishToken: string },
  now: Date
): Promise<FeedUpdateResult> {
  const { publication: previous, sha } = await deps.fetchCurrentFeedFile(env.publishToken);
  const previousItems = previous?.items ?? [];
  const sinceDate = computePubmedSearchSinceDate(previous?.generatedAt ?? null, now);

  const sourceCalls: Array<{ name: string; run: () => Promise<FeedItem[]> }> = [
    { name: 'pubmed', run: () => deps.fetchPubmedItems(sinceDate) },
    { name: 'awmf', run: () => deps.fetchAwmfItems(previousItems) },
    { name: 'fda', run: () => deps.fetchFdaItems(DRUG_WATCHLIST, previousItems) },
    { name: 'ema', run: () => deps.fetchEmaItems(DRUG_WATCHLIST, previousItems) },
  ];

  const collected: FeedItem[] = [];
  const failedSources: string[] = [];

  for (const source of sourceCalls) {
    try {
      collected.push(...(await source.run()));
    } catch (error: unknown) {
      console.error(`Source ${source.name} failed:`, error);
      failedSources.push(source.name);
    }
  }

  if (failedSources.length === sourceCalls.length) {
    throw new Error('All feed sources failed.');
  }

  const newItems = collected.filter((item) => !previousItems.some((existing) => existing.id === item.id));
  const summarized = await deps.summarizeNewItems(newItems, env.anthropicApiKey);

  const merged = mergeAndFilterItems(previousItems, summarized, now);
  const publication = buildPublication(merged, now);

  let published = false;
  if (hasFeedChanged(previous, publication)) {
    await deps.publishFeed(publication, sha, env.publishToken);
    published = true;
  }

  return { publishedItemCount: publication.items.length, failedSources, published };
}
```

- [ ] **Step 4: Test erneut ausführen, Erfolg bestätigen**

Run: `cd feed-service && npx vitest run src/runFeedUpdate.test.ts`
Expected: 5 Tests, alle grün.

- [ ] **Step 5: `index.ts` (Einstiegspunkt) implementieren**

`feed-service/src/index.ts`:

```typescript
import { runFeedUpdate } from './runFeedUpdate';
import { fetchCurrentFeedFile, publishFeed } from './publish';
import { fetchPubmedItems } from './pubmedClient';
import { fetchAwmfItems } from './awmfClient';
import { fetchFdaItems } from './fdaClient';
import { fetchEmaItems } from './emaClient';
import { summarizeNewItems } from './summarize';

async function main(): Promise<void> {
  const anthropicApiKey = process.env.ANTHROPIC_API_KEY;
  const publishToken = process.env.FEED_PUBLISH_TOKEN;

  if (!anthropicApiKey || !publishToken) {
    console.error('Missing required environment variables ANTHROPIC_API_KEY and/or FEED_PUBLISH_TOKEN.');
    process.exit(1);
    return;
  }

  try {
    const result = await runFeedUpdate(
      { fetchCurrentFeedFile, fetchPubmedItems, fetchAwmfItems, fetchFdaItems, fetchEmaItems, summarizeNewItems, publishFeed },
      { anthropicApiKey, publishToken },
      new Date()
    );
    console.log(
      `Feed update finished. Published: ${result.published}. Total items: ${result.publishedItemCount}. Failed sources: ${
        result.failedSources.join(', ') || 'none'
      }.`
    );
  } catch (error: unknown) {
    console.error('Feed update failed:', error);
    process.exit(1);
  }
}

main();
```

- [ ] **Step 6: GitHub-Actions-Workflow anlegen**

`.github/workflows/feed-update.yml`:

```yaml
name: Update News Feed

on:
  schedule:
    - cron: '0 5 * * 1'
  workflow_dispatch: {}

jobs:
  update-feed:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Set up Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '22'

      - name: Install dependencies
        working-directory: feed-service
        run: npm install

      - name: Run feed update
        working-directory: feed-service
        env:
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
          FEED_PUBLISH_TOKEN: ${{ secrets.FEED_PUBLISH_TOKEN }}
        run: npx tsx src/index.ts
```

- [ ] **Step 7: README mit den manuellen Einrichtungsschritten anlegen**

`feed-service/README.md`:

```markdown
# feed-service

Woechentlicher Cronjob (GitHub Actions), der PubMed, AWMF-Leitlinien und
FDA/EMA-Meldungen zu Colitis Ulcerosa abfragt, neue Treffer per Claude API
auf Deutsch zusammenfasst und als `feed.json` im oeffentlichen Repo
`Kettenhund46/colitis-app-feed` veroeffentlicht. Details siehe
`docs/superpowers/specs/2026-07-15-colitis-app-news-feed-datenquelle-design.md`.

## Manuelle Einrichtung (einmalig, nicht automatisierbar)

1. Oeffentliches Repo `Kettenhund46/colitis-app-feed` auf GitHub anlegen
   (leer, nur mit einer kurzen README, die erklaert, dass es sich um
   automatisch aggregierte oeffentliche Fachmeldungen handelt).
2. Ein feingranulares Personal Access Token erstellen, das ausschliesslich
   Schreibrechte (`Contents: Read and write`) auf `colitis-app-feed` hat.
   Als Secret `FEED_PUBLISH_TOKEN` in diesem (privaten) Repo hinterlegen.
3. Einen Anthropic-API-Key erstellen und als Secret `ANTHROPIC_API_KEY` in
   diesem Repo hinterlegen.
4. Workflow einmal manuell ueber "Run workflow" (`workflow_dispatch`) im
   Reiter "Actions" ausloesen, um den ersten Lauf zu pruefen.

## Lokal ausfuehren

```bash
cd feed-service
npm install
ANTHROPIC_API_KEY=... FEED_PUBLISH_TOKEN=... npm start
```

## Tests

```bash
cd feed-service
npm test
npx tsc --noEmit
```
```

- [ ] **Step 8: Gesamte Test-Suite und TypeScript-Check**

Run: `cd feed-service && npm test && npx tsc --noEmit`
Expected: alle Tests grün (69 insgesamt), keine TypeScript-Fehler.

- [ ] **Step 9: Commit**

```bash
git add feed-service/src/runFeedUpdate.ts feed-service/src/runFeedUpdate.test.ts feed-service/src/index.ts feed-service/README.md .github/workflows/feed-update.yml
git commit -m "feat: Orchestrator, Einstiegspunkt und GitHub-Actions-Workflow fuer den News-Feed implementieren"
```

---

## Nach der Umsetzung (manuell, außerhalb dieses Plans)

- Adrian legt das öffentliche Mini-Repo `Kettenhund46/colitis-app-feed` an und hinterlegt die beiden Secrets (siehe `feed-service/README.md`, Task 8 Step 7).
- Ein erster manueller Workflow-Lauf über `workflow_dispatch` bestätigt, dass die echten API-Formate (insbesondere AWMF-Seitenstruktur, openFDA, EMA-RSS – siehe Hinweise in Task 4/5) zur Implementierung passen; bei Abweichungen werden die betroffenen Parser gezielt nachgebessert.
- Nach erfolgreichem ersten Lauf: Teil B (App-Anbindung) kann als eigene Spec/Plan gestartet werden, sobald Adrian das möchte.
