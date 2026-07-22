# Colitis2Go – Design: Lesezeichen/Favoriten im Wissen-Bereich

*Status: Vom Nutzer (Adrian) genehmigt am 2026-07-22*
*Grundlage: bestehendes Wissen-Feature (`src/features/knowledge/`), siebtes Element der Offline-Feature-Roadmap (Punkt 6 "Notizen zu sicheren Orten" war bereits vollständig umgesetzt und entfällt)*

## Kontext & Ziel

Der Wissen-Bereich zeigt fest hinterlegte Artikel (`content/articles.ts`), die beim Öffnen des Tabs in die Datenbank geseedet und über eine durchsuchbare Liste (`wissen/index.tsx`) sowie eine Detailseite (`wissen/[slug].tsx`) angezeigt werden. Es gibt aktuell keine Möglichkeit, Artikel zu markieren, um sie später schneller wiederzufinden. Ziel dieses Schritts: eine Favoriten-Markierung pro Artikel, dauerhaft gespeichert, mit einem Filter in der Übersichtsliste.

## 1. Datenmodell

Neue Tabelle `knowledge_favorites` in `src/db/schema.ts`:

```typescript
export const knowledgeFavorites = sqliteTable('knowledge_favorites', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  articleSlug: text('article_slug').notNull().unique(),
});
```

Migration wird mit `npx drizzle-kit generate` erzeugt (gleicher Ablauf wie bei den bisherigen vier Migrationen in `drizzle/`). Die Tabelle ist bewusst von `knowledge_content` getrennt: Artikel-Inhalte werden bei jedem App-Start per `onConflictDoUpdate` neu geseedet (siehe `seedKnowledgeArticles`), Favoriten sind reine Nutzerdaten und dürfen davon nicht berührt werden.

Neues Repository `src/features/knowledge/db/knowledgeFavoritesRepository.ts`:

```typescript
export async function listFavoriteSlugs(db: KnowledgeDb): Promise<string[]>
export async function addFavorite(db: KnowledgeDb, articleSlug: string): Promise<void>
export async function removeFavorite(db: KnowledgeDb, articleSlug: string): Promise<void>
```

`addFavorite` ist idempotent (erneutes Hinzufügen eines bereits favorisierten Slugs wirft keinen Fehler, z. B. via `onConflictDoNothing`). `removeFavorite` löscht die Zeile per `articleSlug`, ist ebenfalls idempotent (Entfernen eines nicht vorhandenen Favoriten ist ein No-op).

## 2. Filterlogik

Neue reine Funktion in der bestehenden `src/features/knowledge/search.ts` (dieselbe Datei wie die vorhandene `filterKnowledgeArticles`, da beide Funktionen dieselbe Verantwortung – Artikel für die Anzeige filtern – teilen):

```typescript
export function filterFavoriteArticles(articles: KnowledgeArticle[], favoriteSlugs: Set<string>): KnowledgeArticle[]
```

Gibt nur die Artikel zurück, deren `slug` in `favoriteSlugs` enthalten ist, Reihenfolge bleibt wie in `articles` übergeben.

## 3. Detailseite

`src/features/knowledge/components/KnowledgeArticleDetail.tsx` bekommt zwei neue Props:

```typescript
interface KnowledgeArticleDetailProps {
  article: KnowledgeArticle;
  isFavorite: boolean;
  onToggleFavorite: () => void;
}
```

Oberhalb des Artikeltitels erscheint ein Stern-Button: "☆ Favorit" (nicht favorisiert) bzw. "★ Favorit" (favorisiert), gleiche Text-Symbol-Optik wie bestehende Unicode-Icons in der App ("×", "◀"/"▶", "+"). Ein Tap ruft `onToggleFavorite` auf.

`app/(tabs)/wissen/[slug].tsx` lädt beim Öffnen zusätzlich zum Artikel den Favoriten-Status (`listFavoriteSlugs` und prüfen, ob der aktuelle `slug` enthalten ist) und hält ihn in lokalem State. `onToggleFavorite` ruft `addFavorite`/`removeFavorite` auf und aktualisiert den lokalen State sofort (kein Neuladen der ganzen Seite nötig).

## 4. Listenseite

`app/(tabs)/wissen/index.tsx` bekommt:

- Neuen State `viewFilter: 'all' | 'favorites'` (Standard `'all'`), mit zwei Umschalter-Buttons "Alle" / "Favoriten" oberhalb des bestehenden Such-Textfelds (gleiche Optik wie der Liste/Kalender-Umschalter im Tagebuch-Tab).
- Lädt zusätzlich zu den Artikeln die favorisierten Slugs (`listFavoriteSlugs`) beim Fokussieren des Screens, hält sie als `Set<string>` in State.
- Sichtbare Artikel ergeben sich aus: erst `filterKnowledgeArticles(articles, query)` (bestehende Suche), danach zusätzlich `filterFavoriteArticles(...)` angewendet, falls `viewFilter === 'favorites'`. Suche und Favoriten-Filter sind kombinierbar.

`src/features/knowledge/components/KnowledgeArticleList.tsx` bekommt einen neuen optionalen Prop:

```typescript
interface KnowledgeArticleListProps {
  articles: KnowledgeArticle[];
  onSelect: (slug: string) => void;
  emptyMessage?: string;
}
```

Standardwert bleibt der bisherige Text "Keine Artikel gefunden." (Suche ohne Treffer). Beim Favoriten-Filter ohne Treffer übergibt `wissen/index.tsx` stattdessen `"Noch keine Favoriten markiert."`.

## 5. Backup-Integration

Das bestehende Backup-System exportiert **keine** generische Kopie der ganzen Datenbank, sondern eine feste, explizit aufgezählte Tabellenliste (`src/features/backup/types.ts`, `db/backupRepository.ts`, `backupSerializer.ts`). Eine neue Tabelle wird dort nicht automatisch mitgesichert. Damit Favoriten bei einem Restore nicht verloren gehen, wird `knowledge_favorites` wie folgt ergänzt (analog zu `savedPlaces`, das keine Fremdschlüssel-Beziehung hat und daher an beliebiger Stelle in der Lösch-/Einfüge-Reihenfolge stehen darf):

- `src/features/backup/types.ts`: `BackupData['tables']` bekommt `knowledgeFavorites: (typeof knowledgeFavorites.$inferSelect)[]`.
- `src/features/backup/db/backupRepository.ts`: `exportBackupData` liest zusätzlich `await db.select().from(knowledgeFavorites)`; `importBackupData` löscht `knowledgeFavorites` vor dem Neueinfügen (wie bei `savedPlaces`, keine Fremdschlüssel-Abhängigkeit, Reihenfolge in der Transaktion ist unkritisch) und fügt die gesicherten Zeilen mit ihren ursprünglichen IDs wieder ein.
- `src/features/backup/backupSerializer.ts`: `REQUIRED_TABLE_KEYS` bekommt den zusätzlichen Eintrag `'knowledgeFavorites'`, damit `parseBackupData` Sicherungsdateien ohne diese Tabelle (aus einer älteren App-Version) korrekt als ungültig erkennt oder – siehe unten – abwärtskompatibel behandelt.

**Abwärtskompatibilität mit alten Sicherungsdateien:** Da `BACKUP_FORMAT_VERSION` unverändert bei `1` bleibt (reine Tabellenerweiterung, keine Breaking Change der bestehenden Felder), akzeptiert `parseBackupData` nur Dateien, die `knowledgeFavorites` als Array enthalten. Eine Sicherungsdatei, die vor diesem Schritt erstellt wurde, hat dieses Feld nicht und wird beim Import mit der bestehenden Fehlermeldung "Sicherungsdatei ist kein gültiges Format." abgelehnt. Das ist das gleiche Verhalten, das die bestehende `REQUIRED_TABLE_KEYS`-Prüfung schon für alle anderen Tabellen zeigt – keine Sonderbehandlung nötig, aber bewusst in Kauf genommen (alte Backups vor diesem Feature lassen sich damit nicht mehr importieren, sind aber ohnehin durch neuere Backups überholt, sobald der Nutzer einmal nach dem Update ein neues Backup erstellt).

## 7. Fehlerbehandlung

- Artikel wird in der Detailansicht als Favorit markiert/entmarkiert, während die Listenseite im Hintergrund existiert → beim nächsten Fokussieren der Liste (`useFocusEffect`) wird der Favoriten-Status neu geladen, wie es die Liste bei Artikeln ohnehin schon für `articles` tut.
- Favoriten-Filter aktiv, aber keine Artikel favorisiert → eigener Hinweistext statt des generischen Suchtext-Hinweises (siehe Abschnitt 4).
- Doppeltes Hinzufügen/Entfernen desselben Favoriten (z. B. durch schnelles Doppel-Tippen) → beide Repository-Funktionen sind idempotent, kein Fehler.
- Import einer alten Sicherungsdatei ohne `knowledgeFavorites` → wird wie jede andere strukturell unvollständige Sicherungsdatei abgelehnt (siehe Abschnitt 5).

## 8. Testing-Ansatz

- Unit-Tests (Vitest) für `knowledgeFavoritesRepository.ts`: Favorit hinzufügen und in `listFavoriteSlugs` wiederfinden, Favorit entfernen, doppeltes Hinzufügen wirft keinen Fehler, Entfernen eines nicht vorhandenen Favoriten wirft keinen Fehler, gleiches Test-Setup-Muster wie `savedPlacesRepository.test.ts`/`testDb.ts` im Toiletten-Feature (bzw. das äquivalente Setup im Knowledge-Feature, `knowledgeRepository.test.ts`).
- Erweiterte Tests in `search.test.ts` für `filterFavoriteArticles`: leere Favoriten-Menge → leeres Ergebnis, ein favorisierter Slug unter mehreren Artikeln → nur dieser wird zurückgegeben, Reihenfolge bleibt erhalten.
- Erweiterte Tests für `exportBackupData`/`importBackupData` (bestehende Backup-Repository-Tests) und `parseBackupData` (bestehende Serializer-Tests): `knowledgeFavorites` wird beim Export mit ausgelesen, beim Import mit den ursprünglichen IDs wiederhergestellt, und eine Sicherungsdatei ohne `knowledgeFavorites`-Schlüssel wird als ungültig zurückgewiesen.
- UI-Komponenten (`KnowledgeArticleDetail.tsx`, Umschalter in `wissen/index.tsx`) wie bei den bisherigen Features nicht automatisiert testbar – Verifikation über `tsc --noEmit` und manuellen Test (Favorit markieren/entmarkieren, Filter umschalten, Kombination mit Suche, leerer Favoriten-Zustand, alle drei Themes).

## Explizit nicht Teil dieses Schritts

- Kein Stern/Markieren direkt in der Übersichtsliste (nur auf der Detailseite, wie abgestimmt).
- Keine Sortierung der Favoriten nach Datum der Markierung – Reihenfolge folgt der bestehenden Artikel-Reihenfolge.
- Keine Migration bestehender alter Sicherungsdateien (vor diesem Feature erstellt) auf das neue Format – sie werden beim Import wie jede strukturell unvollständige Datei abgelehnt (siehe Abschnitt 5).

---

*Hinweis: Diese App ersetzt keine ärztliche Beratung. Diese Spec betrifft ausschließlich eine technische Markierungs-/Anzeigefunktion für bereits vorhandene Wissensartikel, keine medizinischen Inhalte.*
