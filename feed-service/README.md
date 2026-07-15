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
