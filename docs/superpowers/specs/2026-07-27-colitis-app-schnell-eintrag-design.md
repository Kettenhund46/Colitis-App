# Colitis2Go – Design: Schnell-Eintrag und aufgeräumter Tagebuch-Tab

*Status: Vom Nutzer (Adrian) genehmigt am 2026-07-27*
*Grundlage: Nutzerwunsch nach Verbesserungen an der App (Animationen, Gesten, Bedienbarkeit); nach gemeinsamer Priorisierung auf zwei Punkte eingegrenzt — schnelleres Erfassen von Tagebucheinträgen und Entrümpelung des Tagebuch-Tabs*

## Kontext & Ziel

Die Kernhandlung der App ist der Tagebucheintrag, und bei Colitis ulcerosa fallen davon an schlechten Tagen viele an. Der heutige Weg dorthin ist lang: App öffnen, Tagebuch-Tab, an fünf gestapelten Aktionszeilen vorbei, „+", vollständiges Formular ausfüllen, speichern.

Dieses Vorhaben verkürzt diesen Weg auf einen Tipp und räumt gleichzeitig den Tagebuch-Tab auf, dessen eigentlicher Inhalt heute unter fünf Navigations- und Aktionszeilen liegt.

## Ausgangsbefund

Zwei Feststellungen aus dem bestehenden Code prägen den Entwurf:

**Ein Eintrag ist eine Tageszusammenfassung, kein Einzelereignis.** `calendarLogic.ts` bewertet einen Eintrag ab einer Häufigkeit von 8 als „schlecht" und ab 5 als „mittel". Diese Schwellen ergeben nur für einen Tageswert Sinn. Würde der Schnell-Eintrag pro Tipp einen neuen Eintrag mit Häufigkeit 1 anlegen, bliebe jeder einzelne davon „gut" bewertet und die Schub-Frühwarnung (`flareWarning.ts`, drei schlechte Tage in sieben) würde für Nutzer des Schnell-Eintrags nie mehr auslösen. Das wäre ein inhaltlicher Fehler, kein Darstellungsproblem.

**Nur die Konsistenz ist Pflicht.** `validateDiaryEntryForm` verlangt ausschließlich `stoolConsistency`; alle übrigen Felder haben Vorgabewerte. Ein Schnell-Eintrag ist damit technisch möglich, darf die Konsistenz aber nicht selbst erfinden — bei medizinischen Daten wäre ein stillschweigend gesetzter Vorgabewert eine Falschangabe.

## 1. Erfassungsmodell

Ein Tipp zählt den **heutigen Tageseintrag hoch**, statt einen neuen Eintrag anzulegen:

- Liegt für heute noch kein Eintrag vor, wird einer mit Häufigkeit 1 angelegt.
- Liegt bereits einer vor, steigt dessen Häufigkeit um eins.
- Existieren mehrere Einträge von heute, gilt der jüngste.

Damit bleiben Bewertungslogik, Kalender, Schub-Frühwarnung und Auswertung unverändert gültig.

Zusammenführung bei mehrfacher Erfassung am selben Tag:

- **Konsistenz:** Die schlechtere gewinnt, in der Reihenfolge `hart` < `normal` < `weich` < `waessrig`. Das entspricht der vorhandenen Logik in `rateDayEntries`, die einen Tag ohnehin nach seinem schlechtesten Eintrag bewertet.
- **Blut:** Einmal gesetzt, bleibt gesetzt. Ein Warnsignal darf sich nicht durch einen späteren Tipp stillschweigend selbst zurücknehmen.
- **`occurredAt`:** Bleibt beim Hochzählen unverändert. Der Eintrag markiert den Tag, und die Liste soll nicht bei jedem Tipp umspringen.
- **Übrige Felder** (Schmerz, Symptome, Notiz, Auslöser): unberührt. Der Schnell-Eintrag überschreibt niemals Angaben aus dem vollständigen Formular.

## 2. Aufbau und Dateien

### Neu: `src/features/diary/quickEntryLogic.ts` (plus `.test.ts`)

Reine Logik ohne native Abhängigkeiten, vollständig testbar:

```typescript
export const STOOL_CONSISTENCY_SEVERITY: Record<StoolConsistency, number> = {
  hart: 0,
  normal: 1,
  weich: 2,
  waessrig: 3,
};

export function worseConsistency(a: StoolConsistency, b: StoolConsistency): StoolConsistency

export function findTodaysEntry(
  entries: DiaryEntryWithTriggers[],
  now: Date
): DiaryEntryWithTriggers | null

export interface QuickEntryUpdate {
  stoolFrequency: number;
  hasBlood: boolean;
  stoolConsistency: StoolConsistency;
}

export function buildQuickEntryInput(
  consistency: StoolConsistency,
  hasBlood: boolean,
  occurredAt: string
): NewDiaryEntryInput

export function buildQuickEntryUpdate(
  existing: DiaryEntryWithTriggers,
  consistency: StoolConsistency,
  hasBlood: boolean
): QuickEntryUpdate
```

`findTodaysEntry` nutzt das vorhandene `formatDateKey` aus `calendarLogic.ts`, damit es keinen zweiten Datumsvergleich im Code gibt. Die Eintragsliste ist bereits absteigend nach `occurredAt` sortiert, der erste Treffer ist also der jüngste.

`DiaryEntryWithTriggers.stoolConsistency` ist als `string` typisiert, nicht als `StoolConsistency`. `buildQuickEntryUpdate` prüft den gespeicherten Wert deshalb gegen `STOOL_CONSISTENCY_SEVERITY` und fällt auf `'normal'` zurück, falls ein unbekannter Wert in der Datenbank steht — statt an einem `undefined` aus der Severity-Tabelle zu scheitern.

### Neu: `app/(tabs)/tagebuch/schnell.tsx`

Der Schnell-Eintrag-Bildschirm (siehe Abschnitt 3).

Eine eigene Route statt eines Bottom-Sheets oder einer festen Leiste im Tab: Das Widget braucht ein Deep-Link-Ziel, und das kann nur eine echte Route sein. Eine feste Leiste im Tab würde zudem genau die Zeile zurückbringen, die dieses Vorhaben entfernt.

### Geändert: `src/features/diary/db/diaryRepository.ts`

Neue Funktion:

```typescript
export async function updateDiaryEntryQuickFields(
  db: DiaryDb,
  entryId: number,
  update: QuickEntryUpdate
): Promise<void>
```

Schreibt gezielt nur Häufigkeit, Blut und Konsistenz. Eine Update-Funktion fehlt in diesem Repository bisher vollständig.

### Geändert: `app/(tabs)/tagebuch/_layout.tsx`

Registrierung der neuen Route `schnell` mit dem Titel „Schnell-Eintrag".

### Geändert: `app/(tabs)/tagebuch/index.tsx`

Aufgeräumter Tab (siehe Abschnitt 4), „+" führt auf `/tagebuch/schnell`.

### Geändert: `plugins/withNewDiaryEntryWidget.js`

Deep-Link-Ziel von `colitisapp://tagebuch/neu` auf `colitisapp://tagebuch/schnell`, Beschriftung im Widget-Auswahlmenü von „Neuer Tagebucheintrag" auf „Schnell-Eintrag".

## 3. Der Schnell-Eintrag-Bildschirm

Aufbau von oben nach unten:

```
Kopfzeile: „Schnell-Eintrag"

  Heute: 3 erfasst              (bzw. „Heute noch nichts erfasst")

  [  ] mit Blut

  Konsistenz wählen — das speichert:
  ┌────────┬────────┬────────┬─────────┐
  │  Hart  │ Normal │ Weich  │ Wässrig │
  └────────┴────────┴────────┴─────────┘

  Ausführlichen Eintrag anlegen →
```

**Der Zähler oben** zeigt die `stoolFrequency` des heutigen Eintrags. Existiert für heute bereits ein über das vollständige Formular angelegter Eintrag mit Häufigkeit 5, steht dort entsprechend „Heute: 5 erfasst" — der Zähler bildet den Tageswert ab, nicht die Anzahl der Tipps auf diesem Bildschirm.

**Der Tipp auf eine Konsistenz ist die Speicherung.** Es gibt keinen separaten Speichern-Knopf — der wäre der zweite Tipp, den dieses Vorhaben vermeiden soll. Die Beschriftung über den Knöpfen sagt das ausdrücklich.

**Nach dem Speichern bleibt der Bildschirm stehen** und der Zähler oben springt sichtbar hoch. Das ist die Rückmeldung, und es entspricht dem Alltag: An schlechten Tagen wird mehrfach kurz hintereinander erfasst, und jedes Mal neu hierher zu navigieren wäre lästig. Der Weg zurück ist die normale Zurück-Geste.

**Gegen versehentliches Doppelzählen** sind die vier Knöpfe während des Speichervorgangs gesperrt.

**Der Blut-Schalter** steht bei jedem Öffnen des Bildschirms auf aus und gilt nur für diesen Tipp. Trägt der heutige Eintrag bereits `hasBlood === true`, entfällt der Schalter und an seiner Stelle steht der Hinweis „Für heute ist Blut vermerkt" — zurücknehmen lässt sich das bewusst nicht, und ein Schalter ohne Wirkung wäre irreführend.

**Solange der heutige Stand lädt**, sind die vier Knöpfe gesperrt und der Zähler zeigt „wird geladen …". Ohne das wüsste der erste Tipp nicht, ob er anlegen oder hochzählen muss.

**Der Link „Ausführlichen Eintrag anlegen →"** führt auf das unveränderte Formular unter `/tagebuch/neu`.

**Barrierefreiheit:** Die Konsistenz-Knöpfe erhalten sprechende Bezeichnungen der Form „Weich erfassen" statt nur „Weich", damit per Sprachausgabe erkennbar ist, dass der Tipp eine Aktion auslöst. Die Schaltflächen werden großzügig dimensioniert.

**Fehlerbehandlung:** Scheitert das Laden des heutigen Stands oder das Speichern, erscheint das in der App etablierte Fehlerbanner („Eintrag konnte nicht gespeichert werden." bzw. „Heutiger Stand konnte nicht geladen werden.") und der Zähler bleibt auf dem alten Wert.

## 4. Aufgeräumter Tagebuch-Tab

Bisher stehen fünf Zeilen über der Liste: Liste/Kalender-Umschalter, „Muster-Auswertung ansehen →", „Arztbesuche verwalten →", „Als PDF exportieren", „Als CSV exportieren". Künftig sind es zwei:

```
Kopfzeile: „Tagebuch"                              ⋮

  [Schub-Frühwarnung]        (wie bisher, nur bei Bedarf)
  [Fehlerbanner]             (wie bisher, nur bei Bedarf)

  ┌──────────┬──────────┐
  │  Liste   │ Kalender │
  └──────────┴──────────┘
  ( Auswertung )  ( Arztbesuche )

  ─────────── Liste / Kalender ───────────

                                        ( + )
```

**Der Liste/Kalender-Umschalter bleibt** direkt über der Liste — er steuert sie.

**Die beiden Navigationslinks werden zu kompakten Chips** nebeneinander in einer Zeile statt zweier vollbreiter Zeilen. Der Pfeil entfällt, da ein Chip bereits als antippbar erkennbar ist. Die vollständigen Bezeichnungen „Muster-Auswertung ansehen" und „Arztbesuche verwalten" bleiben als `accessibilityLabel` erhalten.

**Die beiden Exporte wandern in ein Menü rechts oben in der Kopfzeile**, umgesetzt als `Alert.alert` mit dem Titel „Tagebuch exportieren" und den Knöpfen „Als PDF exportieren", „Als CSV exportieren" und „Abbrechen" (letzterer mit `style: 'cancel'`). Das ist das Dialogmuster, das die App an allen anderen Stellen bereits verwendet, und kommt ohne neue Abhängigkeit aus.

Drei Knöpfe sind dabei das Maximum: Ein Android-`AlertDialog` bietet genau drei Schaltflächen. Weitere Menüeinträge lassen sich auf diesem Weg nicht ergänzen — käme später ein vierter hinzu, wäre ein echtes Menü nötig.

Zwei Zustände fängt das Menü ab:

- **Keine Einträge vorhanden:** Der Dialog zeigt statt der Auswahl den Hinweis „Noch keine Einträge zum Exportieren." Das ersetzt die bisherige Ausgrauung der Knöpfe, die es in einem Dialog nicht gibt.
- **Export läuft gerade:** Das Menü-Symbol in der Kopfzeile ist gesperrt.

Die Kopfzeile wird **aus `index.tsx` heraus** über ein `<Stack.Screen options={{ headerRight: … }} />` gesetzt, nicht in `_layout.tsx`. Nur so erreicht der Kopfzeilen-Knopf `entries` und `isExporting`, ohne diesen Zustand über Dateigrenzen zu führen. Gemäß `colitis-app/AGENTS.md` ist dieses Vorgehen vor der Umsetzung gegen die Dokumentation zu SDK 57 unter https://docs.expo.dev/versions/v57.0.0/ zu prüfen.

**Der „+"-Knopf** behält Position und Aussehen, führt aber auf `/tagebuch/schnell` statt auf `/tagebuch/neu`.

## 5. Testansatz

### Automatisiert: `src/features/diary/quickEntryLogic.test.ts` (neu)

- `worseConsistency` — jede Paarung in beide Richtungen geprüft, damit die Reihenfolge nicht nur in einer Richtung zufällig stimmt
- `findTodaysEntry` — leere Liste, nur Einträge von gestern, ein Eintrag von heute, mehrere von heute (der jüngste gewinnt), sowie ein Eintrag von heute vor einem Jahr, damit nicht nur Tag und Monat verglichen werden
- `buildQuickEntryInput` — Häufigkeit 1, Blut wie übergeben, und der Rest nachweislich leer: Schmerz 0, keine Symptome, Notiz `null`, keine Auslöser, `foodTriggerNote` `null`
- `buildQuickEntryUpdate` — Häufigkeit steigt um eins; bereits gesetztes Blut bleibt gesetzt, auch wenn der Schalter diesmal aus ist; die schlechtere Konsistenz gewinnt in beide Richtungen; ein unbekannter Konsistenz-Wert aus der Datenbank fällt auf `normal` zurück

### Automatisiert: Ergänzung in `src/features/diary/db/diaryRepository.test.ts`

`updateDiaryEntryQuickFields` schreibt Häufigkeit, Blut und Konsistenz und lässt Schmerz, Symptome, Notiz und Auslöser unberührt. Prüfung: Eintrag mit vollständig gefüllten Feldern anlegen, aktualisieren, anschließend alle unbeteiligten Felder gegenlesen. Die Datei nutzt bereits eine echte SQLite-Datenbank über better-sqlite3; das vorhandene Muster wird übernommen.

### Nicht automatisiert

Die Bildschirme selbst sind wie bei allen bisherigen Vorhaben dieses Projekts nicht automatisiert testbar, da native Module im Testlauf nicht nachgebildet sind. Absicherung über `tsc --noEmit` und folgenden manuellen Durchgang:

1. Tagebuch-Tab zeigt nur noch zwei Zeilen über der Liste, Menü rechts oben ist vorhanden
2. Menü ohne Einträge zeigt den Hinweistext; mit Einträgen erzeugen PDF und CSV wie bisher
3. Beide Chips führen auf ihre jeweilige Unterseite
4. „+" öffnet den Schnell-Eintrag
5. Erster Tipp am Tag: Zähler springt von „Heute noch nichts erfasst" auf „Heute: 1 erfasst", die Liste zeigt den neuen Eintrag
6. Zweiter Tipp mit schlechterer Konsistenz: Häufigkeit 2, schlechtere Konsistenz übernommen
7. Zweiter Tipp mit besserer Konsistenz: die schlechtere Konsistenz bleibt stehen
8. Mit gesetztem Blut-Schalter erfassen: Eintrag wird als schlecht bewertet; beim erneuten Öffnen ist der Schalter verschwunden und der Hinweis steht an seiner Stelle
9. „Ausführlichen Eintrag anlegen" öffnet das gewohnte Formular
10. Widget öffnet den Schnell-Eintrag

Punkt 10 ist eine native Änderung und wirkt erst mit einem neuen Build. Das EAS-Build-Kontingent des kostenlosen Tarifs ist für Juli aufgebraucht und setzt sich am 01.08.2026 zurück; bis dahin ist das Widget-Verhalten nicht überprüfbar.

## Explizit nicht Teil dieses Schritts

- Keine Änderung an `calendarLogic.ts` und `flareWarning.ts` — deren Unverändertheit war der Grund für die Entscheidung, den Tageseintrag hochzuzählen statt Einzeleinträge anzulegen.
- Keine Änderung am vollständigen Eintragsformular, an Kalender, Auswertung oder den Export-Bausteinen selbst. Von den Exporten wandert ausschließlich der Auslöseknopf.
- Keine Wischgesten, keine Animationen, kein haptisches Feedback. Diese standen im Gespräch ebenfalls zur Wahl, wurden aber für einen späteren, eigenen Schritt zurückgestellt.
- Kein Speichern des Eintrags durch das Widget selbst. Die Datenbank ist SQLCipher-verschlüsselt und liegt in der React-Native-Schicht; ein natives Widget käme nur mit erheblichem nativem Aufwand daran. Das Widget öffnet die App am Schnell-Eintrag, mehr nicht.

---

*Hinweis: Dieses Vorhaben verändert die Erfassung medizinischer Verlaufsdaten. Die Zusammenführungsregeln in Abschnitt 1 — schlechtere Konsistenz gewinnt, gesetztes Blut bleibt gesetzt — sind bewusst so gewählt, dass eine Verschlechterung im Tagesverlauf nicht verloren geht. Die App stellt keine Diagnose und ersetzt keine ärztliche Beurteilung.*

---

## Nachtrag vom 2026-07-27: Tageswerte werden zusammengerechnet

*Vom Nutzer (Adrian) genehmigt, nachdem die Schlussdurchsicht des Zweigs eine Luecke in dieser Spezifikation gefunden hatte.*

Abschnitt 1 behauptete, dass Bewertungslogik, Kalender, Schub-Fruehwarnung und
Auswertung durch das Hochzaehl-Modell unveraendert gueltig bleiben. Das galt nur
unter der stillschweigenden Annahme, dass pro Tag genau ein Eintrag existiert.
Diese Annahme erzwingt die App nicht: Das ausfuehrliche Formular legt weiterhin
einen eigenen Eintrag an, und da der Plus-Knopf nun zum Schnell-Eintrag fuehrt,
ist der geteilte Tag sogar der wahrscheinliche Weg.

Folge: Ein Tag mit fuenf plus vier Stuhlgaengen wurde als "mittel" bewertet statt
als "schlecht", weil die Bewertung das Maximum der Einzeleintraege nahm und nie
summierte. Die Schub-Fruehwarnung zaehlte solche Tage nicht mit. Der
Verlaufschart mittelte. Die Verzerrung ging stets in Richtung beschoenigend.

**Entscheidung:** Ein Tag wird ab sofort anhand seiner zusammengerechneten Werte
bewertet — Haeufigkeit summiert, Schmerz der hoechste Wert des Tages, Blut sobald
irgendein Eintrag des Tages es vermerkt. Die Schwellenwerte selbst bleiben
unveraendert. Der Verlaufschart folgt derselben Regel. Der Zaehler im
Schnell-Eintrag zeigt den Tageswert ueber alle Eintraege und weist aus, wenn
mehrere vorliegen.

Damit entfaellt die Aussage aus dem Abschnitt "Explizit nicht Teil dieses
Schritts", dass calendarLogic.ts und flareWarning.ts unveraendert bleiben:
calendarLogic.ts wird angefasst, flareWarning.ts profitiert unveraendert davon,
weil es rateDayEntries aufruft.

Umsetzung: docs/superpowers/plans/2026-07-27-colitis-app-tageswerte-zusammenrechnen.md
