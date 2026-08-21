# Colitis2Go — Bedienung (Phase 3)

**Datum:** 2026-08-21
**Fahrplan:** `.planning/ROADMAP.md`, Milestone v1, Phase 3
**Vorgänger:** Phase 2 (Gestaltungssprache) — Code in `main` (Merge `24dad83`), Gerätedurchgang offen

## Ziel

Häufige Handgriffe gehen schneller und geben spürbare Rückmeldung.

## Ausgangslage

**Fünf Löschwege, alle mit Bestätigungsdialog.** Überall steht „wird endgültig
gelöscht":

| Ort | Datei |
|---|---|
| Tagebucheintrag | `app/(tabs)/tagebuch/index.tsx:60` |
| Medikament | `app/(tabs)/medikamente/index.tsx:137` |
| Arztbesuch | `app/(tabs)/tagebuch/arztbesuche/index.tsx:52` |
| Sicherer Ort | `app/(tabs)/toiletten/index.tsx:229` |
| Vorsorge-Termin | `src/features/medications/components/ScreeningReminderCard.tsx:68` |

Die ersten drei sind Listenzeilen, die letzten beiden Einzelkarten.

**Die Tab-Wischgeste benutzt `PanResponder`**, nicht `react-native-gesture-handler`.
`src/components/SwipeableTabScreen.tsx` greift nur, wenn die Berührung in einem
25-Pixel-Streifen an einer Bildschirmkante beginnt (`EDGE_WIDTH`) und mindestens
60 Pixel waagerecht läuft (`MIN_HORIZONTAL_DISTANCE`). Die Kommentare dort
dokumentieren, dass diese Grenzen erkämpft wurden: Eine Geste im Randstreifen in
die falsche Richtung hätte sonst die Leaflet-Karte im Toiletten-Tab lahmgelegt.
Ein `swipeEnabled`-Schalter aus `SwipeNavigationContext` kann sie abschalten.

**`react-native-gesture-handler` 3.0.2 liegt im Baum**, transitiv über
expo-router, das es für seine Stack-Ansichten selbst benutzt. Es ist also nativ
verlinkt. Am Wurzel-Layout hängt aber kein `GestureHandlerRootView`, und die App
benutzt heute keine seiner Gesten.

**`expo-haptics` fehlt.** `react-native-reanimated` ist installiert, wird im
App-Code aber nirgends benutzt. Das einzige Stück Bewegung in der ganzen App ist
`src/components/SliderToggle.tsx` mit RNs eingebautem `Animated`.

**`deleteDiaryEntry`** (`src/features/diary/db/diaryRepository.ts:37`) löscht
erst die zugehörigen `triggers`-Zeilen, dann den Eintrag.

## Entscheidungen des Nutzers

1. **Rückgängig ersetzt den Bestätigungsdialog.** Kein Dialog mehr, auch nicht
   beim Löschen-Knopf. Das Rückgängig-Fenster ist die Sicherung.
2. **Die Wischgeste wird mit `PanResponder` gebaut**, demselben Werkzeug wie die
   Tab-Geste — nicht mit `react-native-gesture-handler`. Begründung: kein
   `GestureHandlerRootView` um die ganze App, keine zwei Gestensysteme auf
   demselben Bildschirm, kein Risiko für Tab-Geste und Leaflet-Karte.
3. **Rückgängig gilt überall**, auch bei den beiden Einzelkarten ohne
   Wischgeste. Eine Regel für alle fünf Löschwege.
4. **Kein eigener Haptik-Schalter.** Android und iOS haben je einen systemweiten;
   `expo-haptics` folgt ihm von selbst.

## Architektur

### Rückgängig heißt: noch nicht gelöscht

Zwei Wege wären denkbar — löschen und bei Bedarf wiederherstellen, oder das
Löschen aufschieben. **Aufschieben.**

Grund: Ein Tagebucheintrag hat `triggers`-Zeilen an sich hängen.
Wiederherstellen hieße, Eintrag und Auslöser neu anzulegen — mit neuer
Kennung. Der Eintrag wäre danach ein anderer als vorher, und jede spätere
Beziehung darauf wäre falsch.

**Beide Auslöser gehen denselben Weg.** Die vorhandenen „Löschen"-Knöpfe in den
Karten bleiben, wo sie sind, und lösen künftig genau dasselbe aus wie die
Wischgeste — kein Dialog, wartender Vorgang, Streifen. Auf den beiden
Einzelkarten ohne Liste ist der Knopf der einzige Weg.

Ablauf: Wischen oder Knopf blendet die Zeile aus und startet eine Uhr. Erst wenn die abläuft, geht der Löschbefehl an die Datenbank. „Rückgängig"
hält die Uhr an; es ist dann buchstäblich nichts passiert.

**Fenster: 8 Sekunden.**

**Bei App-Ende während der Uhr passiert nichts.** Der Eintrag ist beim nächsten
Start wieder da. Das ist die richtige Fehlerrichtung: Ein zu viel behaltener
Eintrag ist harmlos, ein zu früh gelöschter nicht.

**Bildschirmwechsel während der Uhr führt das Löschen aus.** Die Zeile ist aus
der Liste verschwunden; sie unbemerkt zurückzuholen wäre schlimmer als das
Löschen zu vollziehen.

**Ein zweites Löschen, während eine Uhr läuft, führt die erste sofort aus.**
Mehrere gleichzeitige Uhren müssten sonst verwaltet werden, und der Streifen
kann ohnehin nur eine zeigen.

### Die Wischgeste

**Nur nach links.** Das ist die verbreitete Richtung fürs Löschen, und es
halbiert die Berührungsfläche mit der Tab-Geste.

**Kein aufgedeckter Knopf.** Über die Schwelle hinaus gewischt heißt gelöscht;
darunter schnappt die Zeile zurück. Weniger Zustände als ein Knopf, der
erscheint, offen bleibt und wieder zugehen muss.

**Die Schwelle liegt bei 96 Pixeln** waagerechter Strecke nach links, und die
Bewegung muss deutlicher waagerecht als senkrecht sein. Der Wert ist bewusst
höher als die 60 Pixel der Tab-Geste: Diese hier ist die zerstörerische von
beiden und soll nicht aus Versehen auslösen, etwa beim Scrollen mit leicht
schräger Fingerbewegung.

**Auflösung des Konflikts mit der Tab-Geste**, zwei Sperren:

1. Die Tab-Geste hängt am äußeren `View` und greift in der **Capture-Phase**,
   also vor den Kindern. Sie übernimmt nur, wenn die Berührung im Randstreifen
   begann. Eine Wischbewegung, die mitten auf einer Zeile anfängt, sieht sie nie.
2. Die Zeilengeste hängt in der **Bubble-Phase** und lehnt zusätzlich ab, wenn
   die Berührung im Randstreifen begann.

Die zweite Sperre ist nicht überflüssig: Ohne sie würde die Zeilengeste im
Randstreifen greifen, sobald `swipeEnabled` aus ist. Dieselbe Berührung täte
dann je nach Einstellung etwas anderes.

Folge: Die 25 Pixel am Rand lassen sich nicht zum Löschen benutzen. Bei rund
400 Pixel Breite ist das der Preis.

### Der Rückgängig-Streifen

Unten über der Tab-Leiste, mit Text und einem Knopf „Rückgängig". Er gehört zum
Bildschirm, nicht zur Liste — sonst verschwände er mit der Liste, wenn deren
letzter Eintrag gelöscht wird.

### Haptik und Bewegung

Ein kurzes Ticken beim Speichern und beim Löschen über `expo-haptics`
(`npx.cmd expo install expo-haptics`, damit die zur SDK 57 passende Version
gewählt wird).

Für reduzierte Bewegung fragt ein Haken `AccessibilityInfo.isReduceMotionEnabled()`
ab und hört auf `reduceMotionChanged`. Ist sie gesetzt: Die Zeile verschwindet
ohne Animation, der Streifen erscheint ohne Einblenden. **Die Geste selbst
bleibt** — sie ist Bedienung, keine Zierde.

### Bausteine

Dieselbe Aufteilung wie in Phase 2, aus demselben Grund: Es gibt keinen
Renderer, also muss alles Entscheidbare in reine Funktionen.

| Datei | Verantwortung | prüfbar |
|---|---|---|
| `src/features/deletion/pendingDeletion.ts` | Zustandsautomat als reine Funktionen | ja |
| `src/components/swipe/swipeDecision.ts` | Gilt diese Bewegung als Löschwisch? | ja |
| `src/components/swipe/SwipeableRow.tsx` | Hülle über der Geste | nein |
| `src/components/ui/UndoBar.tsx` | Der Streifen | nein |
| `src/hooks/useReducedMotion.ts` | Systemeinstellung lesen und beobachten | nein |
| `src/lib/haptics.ts` | Schmale Kapsel um `expo-haptics` | nein |

`haptics.ts` existiert, damit kein Aufrufer direkt an der Bibliothek hängt und
damit die Absicht im Namen steht (`saveFeedback`, `deleteFeedback`) statt der
Mechanik (`impactAsync(ImpactFeedbackStyle.Light)`).

## Prüfung

**Randbedingung wie in Phase 2:** Vitest läuft mit `environment: 'node'`, ohne
jsdom und ohne Renderer. Es darf keine Test-Abhängigkeit hinzukommen. Gesten,
Zeitverhalten im UI und Haptik sind nicht nachbildbar.

Getestet werden die beiden reinen Module:

**`pendingDeletion.ts`** — der eigentliche Prüfgegenstand dieser Phase:
- Löschen anfordern setzt einen wartenden Vorgang
- Rückgängig macht ihn zunichte, ohne dass gelöscht wurde
- Ablauf der Uhr gibt den auszuführenden Löschbefehl zurück
- Ein zweites Löschen bei laufender Uhr gibt den ersten zur sofortigen
  Ausführung frei und setzt den zweiten als wartend
- Rückgängig ohne wartenden Vorgang tut nichts

**`swipeDecision.ts`**:
- Bewegung nach links über der Schwelle, mitten auf der Zeile begonnen: ja
- Dieselbe Bewegung, im Randstreifen begonnen: nein
- Bewegung nach rechts: nein
- Überwiegend senkrechte Bewegung: nein
- Bewegung unter der Schwelle: nein

Die 477 vorhandenen Tests müssen grün bleiben.

Alles Sichtbare und Fühlbare wird auf dem Gerät geprüft, zusammen mit den
offenen Abnahmepunkten aus Phase 1 und 2.

## Bewusst nicht enthalten

- **Wischen in die andere Richtung** für eine zweite Aktion (bearbeiten,
  archivieren). Es gibt heute keine zweite Aktion, die das verdient.
- **Wischen auf den beiden Einzelkarten.** Eine Karte ohne Liste hat keine
  Wischrichtung, die etwas bedeutet.
- **Ein eigener Haptik-Schalter** in den Einstellungen.
- **Bewegung über das Nötige hinaus.** Kein Federn, kein Pulsieren, keine
  Übergänge zwischen Bildschirmen. Diese Phase bringt genau zwei bewegte
  Dinge mit: das Mitwandern der Zeile unter dem Finger und ihr Verschwinden.
- **Haptik an anderen Stellen** als Speichern und Löschen.

## Risiko

Die Tab-Wischgeste und die Leaflet-Karte im Toiletten-Tab sind laut den
Kommentaren in `SwipeableTabScreen.tsx` schon einmal mühsam zum Laufen gebracht
worden. Diese Phase fügt eine zweite Geste auf denselben Bildschirmen hinzu.
Der Entwurf hält beide im selben System und trennt sie über den Startpunkt der
Berührung — aber ob das auf dem Gerät trägt, zeigt erst das Gerät. Der
Abnahmedurchgang muss beide alten Gesten ausdrücklich nachprüfen, nicht nur die
neue.
