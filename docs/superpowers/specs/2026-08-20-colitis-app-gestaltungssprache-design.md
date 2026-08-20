# Colitis2Go — Gestaltungssprache (Phase 2)

**Datum:** 2026-08-20
**Fahrplan:** `.planning/ROADMAP.md`, Milestone v1, Phase 2
**Vorgänger:** Phase 1 (Erinnerung und Schweregrad) — Code in `main`, Gerätedurchgang teilweise offen

## Ziel

Die App nutzt ihre vorhandene Farbpalette gestalterisch aus, statt jeden Inhalt
in gleich aussehende Zeilen mit einem Pixel Rand zu setzen.

## Ausgangslage

Ein Kartenmuster existiert bereits — als Kopie. Die Folge
`backgroundColor: colors.surface`, `borderRadius: 12`, `borderWidth: 1`,
`borderColor: colors.border`, `padding: tokens.spacing.md` steht 113-mal
wörtlich in 36 Dateien. Die `12` ist überall hart getippt, obwohl
`tokens.radius.md` genau diesen Wert hat.

Daraus folgt der Fehler, der Phase 2 ausgelöst hat: Es gibt keine Karte, die
man falsch benutzen könnte, nur eine Konvention, die man vergessen kann. In
Phase 1 wurde der Erinnerungs-Block als Karte gebaut, während alle anderen
Abschnitte desselben Bildschirms flach auf dem Hintergrund liegen. Behoben in
`00a2cc8`, aber die Ursache blieb.

Acht Leerzustände, alle nach demselben Bauplan: ein grauer Satz, zentriert.
Keiner sagt, was hier entstehen wird — bestenfalls, welche Taste man drückt.

Elf Ladezustände, alle als Text: „Medikamente werden geladen …".

Die Palette in `src/theme/palettes.ts` ist bewusst gewählt — warmes Creme,
Salbeigrün, gedämpftes Orange — und wird von den Layouts kaum abgerufen.
`accent` und `primary` kommen fast nirgends vor. Die App ist grau auf beige
mit gelegentlich rotem Löschen-Knopf.

## Entscheidungen des Nutzers

Alle drei in der visuellen Begleitung getroffen:

1. **Umfang:** Aufwerten auf gemeinsamer Basis. Erst die Bausteine
   herausziehen, dann in diesen wenigen Dateien wirklich gestalten. Nicht:
   bloßes Aufräumen, nicht: neue Gestaltungsrichtung.
2. **Kartenform:** Erhebung plus Akzentkante links, die einen Zustand trägt.
   Der Nutzer hat diese Form gewählt, nachdem der Einwand vorlag, dass die
   farbige Seitenkante als abgenutztes Muster gilt.
3. **Reichweite der Kante:** Überall, wo eine Liste einen Zustand hat — nicht
   nur im Tagebuch, und nicht nur dort, wo die Kante etwas Ungesagtes trägt.
4. **Leerzustände:** Geisterkarte — eine blasse Karte in der Form des
   kommenden Inhalts, darunter Erklärung und Einstiegsknopf.

## Architektur

Fünf neue Bausteine unter `src/components/ui/`. Danach benutzen alle
Bildschirme sie, statt das Muster zu wiederholen.

### `Card.tsx`

Fläche, Rundung, Erhebung, optionale Zustandskante.

```
interface CardProps {
  children: ReactNode;
  accent?: CardAccent;        // Bedeutung, nicht Farbe
  isMuted?: boolean;          // ausgegraut, z. B. beendete Medikamente
  style?: StyleProp<ViewStyle>;
}

type CardAccent = 'good' | 'warning' | 'danger' | 'info' | 'neutral';
```

`accent` nimmt eine **Bedeutung** entgegen, keine Farbe. Die Zuordnung
Bedeutung → Farbe steckt in der Karte, damit sie an einer Stelle änderbar
bleibt. Ohne `accent` hat die Karte keine Kante.

Jede der fünf Bedeutungen hat einen Einsatzort — keine wird auf Vorrat
angelegt:

| Wert | Einsatzort |
|---|---|
| `good` | guter Tag im Tagebuch, laufendes Medikament |
| `warning` | mittlerer Tag im Tagebuch |
| `danger` | schub-verdächtiger Tag im Tagebuch |
| `info` | ungelesene Neuigkeit |
| `neutral` | beendetes Medikament, vergangener Arztbesuch |

`accent` und `isMuted` sind unabhängig und werden kombiniert: Ein beendetes
Medikament bekommt `accent="neutral"` (graue Kante) **und** `isMuted`
(gedämpfter Inhalt).

Rundung: `tokens.radius.md`. Die hart getippte `12` verschwindet.

### `GhostCard.tsx`

Die blasse Karte in der Form eines Eintrags. Nimmt entgegen, wie viele
Textzeilen sie andeuten soll, und ob sie eine Kopfzeile mit Marke zeigt.
Keine Bewegung, kein Pulsieren — siehe „Bewusst nicht enthalten".

### `EmptyState.tsx`

Geisterkarte, Überschrift, Erklärung, optionaler Knopf.

```
interface EmptyStateProps {
  title: string;
  description: string;
  action?: { label: string; onPress: () => void };
  ghostLines?: number;
}
```

### `SkeletonList.tsx`

Mehrere `GhostCard` untereinander, für die listenförmigen Ladezustände.

### `SectionHeading.tsx`

Abschnittsüberschrift für die Einstellungen. Existiert, damit der Fehler aus
Phase 1 — ein Abschnitt in fremder Gestaltungssprache — nicht wiederholbar
ist.

### Erhebung als Theme-Eigenschaft

Die Erhebung wird kein Wert im Aufrufer, sondern eine Eigenschaft des Themes.
Neben `palettes` kommt eine Beschreibung, wie eine Fläche in diesem Theme vom
Hintergrund abgesetzt wird:

| Theme | Mittel |
|---|---|
| Hell | Schatten, kein Rand |
| Hellblau | Schatten, kein Rand |
| Dunkel | Rand, kein Schatten |

**Begründung für Dunkel:** Android leitet den Schatten aus `elevation` ab. Auf
dunklem Grund ist er praktisch unsichtbar. Statt Tiefe vorzutäuschen, trennt
dort ein feiner Rand die hellere Kartenfläche (`surface` #262320) vom
Hintergrund (`background` #1C1A17).

Der aufrufende Bildschirm muss davon nichts wissen. `Card` liest die
Beschreibung über `useTheme()`.

## Abstufung innerhalb der Karte

Titel `tokens.typography.fontSize.md` fett, Detail `fontSize.sm` in
`colors.textSecondary`. Das ist heute überwiegend schon so, aber uneinheitlich
— `Card` erzwingt es nicht technisch, aber alle Aufrufer werden darauf
gebracht.

## Leerzustände

Acht Stellen. Sie zerfallen in **zwei Arten**, die nicht gleich behandelt
werden dürfen:

**Art 1 — hier entsteht noch etwas** (Geisterkarte, Erklärung, Knopf):

| Ort | heute |
|---|---|
| `DiaryHistoryList` | „Noch keine Einträge. Tippe auf „+“ …" |
| `MedicationList` | „Noch keine Medikamente. Tippe auf „+“ …" |
| `DoctorVisitList` | „Noch keine Arztbesuche. Tippe auf „+“ …" |
| `TriggerAnalysisView` | „Noch keine Auswertung möglich. …" |
| `NewsFeedList` | „Noch keine Neuigkeiten vorhanden." |
| `KnowledgeArticleList` (Favoriten) | „Noch keine Favoriten markiert." |

**Art 2 — eine Abfrage hat nichts geliefert** (nur Text, keine Geisterkarte,
kein Knopf — es gibt nichts anzulegen):

| Ort | heute |
|---|---|
| `KnowledgeArticleList` (Suche) | „Keine Artikel gefunden." |
| `DiaryTrendChart` | „Keine Daten in diesem Zeitraum." |

Eine Geisterkarte bei einer ergebnislosen Suche wäre irreführend: Sie
verspräche Inhalt, der durch Anlegen entstünde, obwohl der Nutzer nur seinen
Suchbegriff ändern muss.

Alle sechs Texte der Art 1 werden neu geschrieben und müssen **beides** sagen:
was hier entsteht und wodurch. Die genauen Formulierungen werden im
Umsetzungsplan einzeln ausgeschrieben, nicht als „passende Texte einsetzen"
delegiert.

## Ladezustände

Elf Stellen, drei Behandlungen:

**Listenförmig → `SkeletonList`** (6): `medikamente/index`,
`tagebuch/arztbesuche/index`, `tagebuch/auswertung`, `tagebuch/index`,
`wissen/feed`, `wissen/index`.

**Einzelsatz-Bildschirme → unverändert Text** (3): `medikamente/[id]`,
`tagebuch/arztbesuche/[id]`, `wissen/[slug]`. Ein Skelett in Formularform
wäre ein eigener Baustein für drei Stellen, an denen das Laden aus der
lokalen Datenbank ohnehin kaum sichtbar ist. YAGNI.

**Bleiben wie sie sind** (2): `app/_layout.tsx` („Datenbank wird geladen …",
der Startbildschirm vor dem Theme) und `tagebuch/schnell.tsx` (Wortfragment
in einem Satz, keine eigene Ansicht).

## Palette

Eine Änderung, aufgefallen beim Durchspielen der drei Themes:

`success` und `primary` sind **derselbe Wert** — im hellen Theme beides
Salbeigrün `#5B8C7B`, im hellblauen beides `#3E7CB1`, im dunklen beides
`#7BAF9C`. Ein guter Tag bekommt damit dieselbe Farbe wie jeder Knopf und
jeder Schalter; „gut" ist keine eigene Aussage mehr.

`success` wird in allen drei Themes ein eigener Wert. Zwei Randbedingungen,
damit der Umsetzungsplan nicht frei erfindet:

- `primary` bleibt in allen drei Themes **unverändert**. Nur `success`
  bewegt sich, damit kein Knopf und kein Schalter der App die Farbe wechselt.
- `success` bleibt grün — auch im hellblauen Theme, wo es heute blau ist.
  Grün ist im Tagebuch die Bedeutung „guter Tag" und steht neben Gelb und Rot
  in einer Ampel; ein blaues Glied darin wäre nicht lesbar.

Die genauen Werte legt der Umsetzungsplan fest. Sie müssen gegen `surface`
desselben Themes ausreichend Kontrast haben und von `warning` und `danger`
desselben Themes unterscheidbar sein.

Keine weiteren Palettenänderungen.

## Barrierefreiheit

Die Kante ist **Zugabe, nie die einzige Information**. Die Regel aus Phase 1
gilt unverändert: Form (Dreieck/Quadrat/Kreis) und Wort stehen weiterhin
daneben. Wer Farben nicht unterscheidet, verliert nichts.

Vorhandene `accessibilityLabel` bleiben unverändert. `Card` fügt keine
eigenen Rollen hinzu — wo heute ein `Pressable` die Karte ist, bleibt es das.

## Umfang und Vorgehen

36 Dateien, aufgeteilt in zwei Hälften:

1. **Bausteine bauen** — wenige Dateien, eigene Tests, klein prüfbar.
2. **Aufrufer umstellen** — viele Dateien, jede Änderung mechanisch. Nach
   Bereichen getrennt (Tagebuch, Medikamente, Arztbesuche, Wissen/News,
   Einstellungen), damit jeder Schritt für sich auf dem Gerät prüfbar bleibt.

## Prüfung

Die 463 vorhandenen Tests müssen weiterhin grün sein — das ist die
Rückversicherung gegen Kollateralschaden beim Umstellen.

Eigene Tests bekommen nur die Bausteine, weil nur dort Verhalten steckt:
- `Card` setzt bei `accent` eine Kante, ohne `accent` keine
- `Card` benutzt im dunklen Theme Rand statt Schatten
- `EmptyState` zeigt den Knopf nur, wenn `action` übergeben wurde

Gestaltung selbst ist im Testlauf nicht nachbildbar. Der Rest wird auf dem
Gerät geprüft, zusammen mit den offenen Abnahmepunkten 9 bis 11 aus Phase 1.

## Bewusst nicht enthalten

- **Bewegung im Ladeplatzhalter.** Ein pulsierendes Skelett wäre Bewegung
  ohne Aussage und müsste die Systemeinstellung für reduzierte Bewegung
  berücksichtigen. Das gehört zu Phase 3, die Bewegung insgesamt behandelt.
- **Neue Symbole oder Grafiken.** Der Leerzustand mit großem Zeichen wurde
  verworfen.
- **Änderungen an Formularen und Modalen** über die Kartenform hinaus.
- **Bildschirme umbauen.** Phase 2 ändert, wie Inhalte aussehen, nicht welche
  Inhalte wo stehen.

## Risiko

Das ist die größte Einzeländerung des Projekts bisher. Ein Fehler beim
Umstellen der 36 Dateien zeigt sich nicht im Testlauf, sondern erst auf dem
Gerät. Die Aufteilung nach Bereichen ist die Gegenmaßnahme.

## Offener Punkt außerhalb dieser Phase

Beim Lesen von `MedicationList.tsx` fiel auf, dass Teile von **Phase 4**
(Medikamenteneinnahme abhaken) bereits gebaut sind: ein Knopf „Heute genommen
✓" mit `takenTodayIds` und `onTakenToday`. Der Fahrplan stimmt an dieser
Stelle nicht mehr. Nach Phase 2 zu klären, nicht Teil dieses Entwurfs.
