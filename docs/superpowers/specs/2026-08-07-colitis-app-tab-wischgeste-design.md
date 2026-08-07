# Colitis-Ulcerosa-App – Design: Wischgeste zum Tab-Wechsel

*Status: Vom Nutzer (Adrian) genehmigt am 2026-08-07*
*Grundlage: [2026-07-07-colitis-ulcerosa-app-design.md](2026-07-07-colitis-ulcerosa-app-design.md) (Hauptspec)*

## Kontext & Ziel

Bisher lässt sich zwischen den fünf Tabs nur über die Tab-Leiste am unteren Bildschirmrand wechseln. Adrian möchte zusätzlich per Wischgeste zwischen den Tabs wechseln können.

Dieses Dokument beschreibt ausschließlich die Wischgeste. Der ebenfalls gewünschte Mehrsprachen-Support ist ein eigenständiges, deutlich größeres Teilprojekt (67 der 130 Quelldateien enthalten fest eingebaute deutsche Texte) und bekommt eine eigene Spec, sobald dieses Vorhaben abgeschlossen ist.

## Technische Ausgangslage (geprüft am 2026-08-07)

- Expo Router v57 verwendet native Tabs **ohne eingebaute Wisch-Unterstützung**. Es gibt keine `swipeEnabled`-Option; Wischen muss nachgerüstet werden.
- `react-native-gesture-handler` (v3.0.2) ist bereits im Projekt vorhanden (transitiv über `expo-router`). Ein Ansatz auf dieser Basis erfordert **keinen neuen nativen EAS-Build**.
- `react-native-pager-view` ist **nicht** installiert. Ein echter Pager (Inhalt folgt live dem Finger) wäre eine neue native Abhängigkeit und würde einen neuen Build erzwingen.
- Der Toiletten-Tab rendert eine Leaflet-Karte in einem `react-native-webview`. Waagerechtes Ziehen dort verschiebt die Karte – ein direkter Konflikt mit einer Wischgeste über die volle Breite.
- Die Tabs `tagebuch`, `wissen` und `medikamente` haben verschachtelte Unterseiten und sind mit `popToTopOnBlur: true` konfiguriert: Beim Verlassen eines Tabs wird dessen Unterseiten-Verlauf verworfen.

## Entscheidungen (mit Adrian abgestimmt)

- **Wisch-Gefühl:** „Flick" – eine erkannte Wischgeste wechselt den Tab mit der normalen Tab-Animation. Der Inhalt folgt **nicht** live dem Finger. Begründung: nutzt die bereits vorhandene Gesten-Bibliothek, kein neuer nativer Build, kein Umbau der Tab-Struktur, Aussehen der Tab-Leiste bleibt unverändert.
- **Karten-Konflikt:** Die Geste startet einheitlich auf allen Tabs nur in einem 25 Pixel breiten Streifen am linken bzw. rechten Bildschirmrand. Die Karte behält damit ihre gesamte Fläche. Einheitliches Verhalten wurde einer bequemeren, aber je nach Tab unterschiedlichen Regel vorgezogen.
- **Unterseiten:** Wischen wechselt den Tab **nur auf den fünf Tab-Startseiten**. Auf Unterseiten behält die Randgeste ihre gewohnte „Zurück"-Bedeutung, und angefangene Formulareingaben können nicht versehentlich verworfen werden (was wegen `popToTopOnBlur` sonst passieren könnte).
- **Verhalten an den Enden:** Kein Rundlauf. Auf dem ersten Tab passiert beim Wischen zurück nichts, auf dem letzten beim Wischen weiter nichts.

## 1. Verhalten

Die Tab-Reihenfolge entspricht der Tab-Leiste:

`tagebuch` → `wissen` → `medikamente` → `toiletten` → `einstellungen`

(Die Route `app/(tabs)/index.tsx` ist mit `href: null` ausgeblendet und nimmt an der Reihenfolge nicht teil.)

Die fünf Bezeichner sind zugleich die Navigationsziele: `/tagebuch`, `/wissen`, `/medikamente`, `/toiletten`, `/einstellungen`. In `app/(tabs)/_layout.tsx` heißen zwei der Einträge `toiletten/index` bzw. `einstellungen/index`, weil diese Tabs keine eigene `_layout.tsx` haben – das ist ein reiner Registrierungs-Unterschied und ändert die Navigationspfade nicht.

- Ziehen vom **linken** Bildschirmrand nach rechts → vorheriger Tab.
- Ziehen vom **rechten** Bildschirmrand nach links → nächster Tab.
- Die Geste wird nur erkannt, wenn sie in einem **25 Pixel** breiten Streifen am jeweiligen Rand beginnt.
- Damit Tippen und senkrechtes Scrollen nicht stören, muss die waagerechte Bewegung **mindestens 60 Pixel** betragen und ihr Betrag größer sein als der der senkrechten Bewegung.
- Am Anfang bzw. Ende der Reihe passiert nichts – ohne Meldung, ohne Animation.

## 2. Aufbau

Drei klar getrennte Bausteine:

### `src/navigation/tabOrder.ts` (neu)
Einzige Quelle der Tab-Reihenfolge. Enthält die geordnete Liste der fünf Tab-Namen sowie eine reine Funktion, die aus aktuellem Tab und Wischrichtung den Ziel-Tab bestimmt und `null` zurückgibt, wenn kein Nachbar existiert (Ende der Reihe) oder der übergebene Tab-Name unbekannt ist.

Kennt weder React noch Gesten noch Router – dadurch vollständig automatisiert testbar.

### `src/components/SwipeableTabScreen.tsx` (neu)
Anzeige-/Gesten-Hülle. Nimmt als Eigenschaften entgegen, auf welchem Tab sie sitzt, sowie die üblichen Stil- und Kind-Elemente. Erkennt die Randgeste, ermittelt über die Funktion aus `tabOrder.ts` das Ziel und navigiert bei einem Treffer dorthin. Enthält selbst keine Kenntnis der Reihenfolge.

Liegt in `src/components/`, wo bereits wiederverwendbare Bausteine wie `SliderToggle.tsx` liegen.

### Die fünf Tab-Startseiten (geändert)
`app/(tabs)/tagebuch/index.tsx`, `app/(tabs)/wissen/index.tsx`, `app/(tabs)/medikamente/index.tsx`, `app/(tabs)/toiletten/index.tsx`, `app/(tabs)/einstellungen/index.tsx`

In jeder wird das äußerste `<View style={styles.container}>` durch `<SwipeableTabScreen tab="…" style={styles.container}>` ersetzt. Kein zusätzliches Verschachteln, keine weiteren Änderungen am Seiteninhalt.

**`app/(tabs)/_layout.tsx` bleibt unverändert.** Dadurch ist ausgeschlossen, dass sich Aussehen oder Verhalten der Tab-Leiste ändern.

Dass die Geste nur auf Startseiten greift, ergibt sich aus dieser Struktur von selbst: Unterseiten verwenden die Hülle schlicht nicht. Es braucht keine Pfad-Erkennung.

## 3. Fehlerbehandlung

Die Funktion speichert und lädt nichts; es gibt keine Fehlerzustände im eigentlichen Sinn. Die beiden Randfälle werden bewusst still behandelt:

- Wischen am Anfang/Ende der Reihe: keine Navigation, keine Meldung, kein Protokolleintrag.
- Zu kurze oder zu schräge Bewegung: Geste greift nicht, Anzeige bleibt unverändert.

Beides ist erwartetes Verhalten, kein Fehler.

## 4. Testing-Ansatz

- **Automatisiert (Vitest):** die reine Reihenfolge-Funktion aus `tabOrder.ts` – Nachbar in beide Richtungen, `null` an beiden Enden, `null` bei unbekanntem Tab-Namen.
- **Manuell auf dem Gerät:** die Gesten-Hülle und das tatsächliche Wischverhalten. React Native lässt sich unter dem Test-Runner dieses Projekts (Vitest) nicht parsen oder rendern – bestätigte Einschränkung seit Umsetzungsschritt 2. Zu prüfen sind: Wechsel in beide Richtungen, Enden ohne Reaktion, Karte im Toiletten-Tab weiterhin frei verschiebbar, Unterseiten unbeeinflusst. Diese Punkte werden in die bestehende Alltagstest-Checkliste (`docs/superpowers/colitis-app-alltagstest-checkliste.md`) aufgenommen.

## Explizit nicht Teil dieses Vorhabens

- Kein Ein-/Ausschalter für die Geste in den Einstellungen
- Kein einmaliger Hinweis / Onboarding-Tipp zur Wischgeste
- Kein Wischen auf Unterseiten, kein Rundlauf am Reihenende
- Keine Änderung an der Tab-Leiste oder an `app/(tabs)/_layout.tsx`
- Kein Pager-Verhalten (Inhalt folgt dem Finger) und damit keine neue native Abhängigkeit
- Mehrsprachigkeit – eigenes Teilprojekt mit eigener Spec
