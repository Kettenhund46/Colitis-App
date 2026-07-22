# Colitis2Go – Design: Android-Homescreen-Widget

*Status: Vom Nutzer (Adrian) genehmigt am 2026-07-22*
*Grundlage: bestehender Config-Plugin `plugins/withNearestToiletShortcut.js` als Vorbild für natives Android-Customizing, zwölftes Element der Offline-Feature-Roadmap*

## Kontext & Ziel

Die App hat bisher keinen Homescreen-Zugriffspunkt außer dem statischen App-Shortcut (Long-Press auf das App-Icon → "Nächste Toilette"). Ziel dieses Schritts: ein echtes Android-Homescreen-Widget, das einen Schnellzugriff zum Anlegen eines neuen Tagebucheintrags bietet, ohne die App vorher öffnen und navigieren zu müssen.

**Wichtiger Unterschied zu allen bisherigen Features:** Dies ist das erste Feature der Roadmap, das echten nativen Android-Code (Kotlin, XML-Ressourcen, Manifest-Änderungen) statt reiner TypeScript/Expo-Managed-APIs benötigt. Ein Homescreen-Widget lässt sich nur in einem Development-Client-Build testen, nicht in Expo Go – die App hat dafür bereits `expo-dev-client` und einen EAS-Development-Build-Profil eingerichtet (`eas.json`), das passt also grundsätzlich. Es gibt bereits einen kleinen präzedenzsetzenden Config-Plugin (`plugins/withNearestToiletShortcut.js`) für einen statischen App-Shortcut, an dessen Aufbau sich dieses Feature eng anlehnt.

## 1. Verhalten & Ziel

Ein kompaktes 1x1-Homescreen-Widget mit einem Stift/Plus-Symbol. Ein Tap auf das Widget öffnet die App direkt auf dem bestehenden "Neuer Eintrag"-Bildschirm (`app/(tabs)/tagebuch/neu.tsx`) über den vom Router bereits unterstützten Deep-Link `colitisapp://tagebuch/neu`. Anders als beim bestehenden `schnellzugriff`-Shortcut (der erst Standort/DB-Logik ausführt, bevor er weiterleitet) ist hier keine Zwischen-Logik nötig – expo-router löst den Pfad direkt auf, kein Zwischenbildschirm erforderlich.

Das Widget zeigt keine Live-Daten (kein Status, keine Symptomwerte) – reiner Schnellzugriff-Button, bewusst so gewählt, um die Komplexität gering zu halten (kein Bridging von Daten aus der SQLCipher-verschlüsselten Datenbank in nativen Widget-Code nötig).

## 2. Natives Widget (Config-Plugin)

Neue Datei `plugins/withNewDiaryEntryWidget.js`, nach dem Muster von `plugins/withNearestToiletShortcut.js` (mehrere `with*`-Hilfsfunktionen, kombiniert in einer exportierten Haupt-Funktion, unter Verwendung von `withDangerousMod`/`withAndroidManifest` aus `expo/config-plugins`):

- **Widget-Layout** (`res/layout/widget_new_diary_entry.xml`): ein einzelnes klickbares `ImageView` mit dem Stift/Plus-Icon, zentriert im Widget-Rahmen.
- **Icon-Drawable**: die bereits vorhandene `assets/images/android-icon-monochrome.png` wird beim Prebuild per `withDangerousMod` nach `android/app/src/main/res/drawable/widget_new_diary_entry_icon.png` kopiert (kein neuer Asset nötig, passendes monochromes Symbol bereits vorhanden).
- **Widget-Info** (`res/xml/new_diary_entry_widget_info.xml`): beschreibt Größe (`minWidth`/`minHeight` ≈ `40dp`, entspricht einer 1x1-Zelle), `resizeMode="none"`, `updatePeriodMillis="0"` (rein statisch, kein periodisches Update, da keine Live-Daten), `widgetCategory="home_screen"`, referenziert das Layout aus dem vorherigen Punkt.
- **Kotlin-Klasse** (`android/app/src/main/java/<package-pfad>/NewDiaryEntryWidgetProvider.kt`, wird per `withDangerousMod` in den generierten Android-Projektbaum geschrieben): eine minimale `AppWidgetProvider`-Unterklasse. In `onUpdate` wird pro Widget-Instanz ein `PendingIntent` mit `Intent(Intent.ACTION_VIEW, Uri.parse("colitisapp://tagebuch/neu"))` erzeugt und über `RemoteViews.setOnClickPendingIntent(...)` auf das Icon-`ImageView` registriert. Dieser Deep-Link-Mechanismus ist bereits durch den bestehenden Toiletten-Shortcut (`colitisapp://schnellzugriff`) im Projekt erprobt.
- **AndroidManifest-Eintrag**: ein `<receiver>`-Element für `NewDiaryEntryWidgetProvider` mit Intent-Filter `android.appwidget.action.APPWIDGET_UPDATE` und `meta-data`-Verweis auf die Widget-Info-XML aus Punkt 2 – analog zur bestehenden `withAndroidManifest`-Ergänzung des Shortcut-Plugins (dort für `android.app.shortcuts`).
- `plugins/withNewDiaryEntryWidget.js` wird in `app.json` unter `expo.plugins` neben `./plugins/withNearestToiletShortcut` ergänzt.

## 3. Darstellung/Theming

Der Widget-Hintergrund folgt Androids System-Darkmode über `values`/`values-night`-Ressourcenqualifizierer (helle/dunkle Hintergrundfarbe für das Icon-Feld) – unabhängig vom In-App-Theme-Umschalter (Standard/Dunkel/Blau-Weiß), da natives Widget-Rendering keinen Zugriff auf den React-Theme-Context hat. Das ist Standardverhalten für Android-Widgets und bewusst vom In-App-Theming entkoppelt (siehe "Explizit nicht Teil dieses Schritts").

## 4. Fehlerbehandlung

- Kein Sonderfall für "App nicht installiert" o. Ä. nötig – das Widget existiert nur, wenn die App installiert ist.
- Tap auf das Widget bei laufender App im Hintergrund (Warm Start) oder bei geschlossener App (Cold Start) wird beides über denselben Deep-Link-Mechanismus abgedeckt, den expo-router bereits für alle Szenarien unterstützt (kein zusätzlicher Code nötig).

## 5. Testing-Ansatz

Wie beim bestehenden `withNearestToiletShortcut.js` gibt es für den Config-Plugin-Code keine automatisierten Tests (reine Android-Build-Artefakte/Codegenerierung, kein Testfile beim Vorbild vorhanden). Verifikation ausschließlich manuell nach einem neuen Development-Build:

- `npx.cmd expo prebuild --clean` (bzw. EAS-Development-Build) ausführen, prüfen dass der Build ohne Fehler durchläuft.
- Widget aus der Android-Widget-Liste zum Homescreen hinzufügen, Größe/Icon-Darstellung prüfen.
- Tap auf das Widget → App öffnet sich direkt auf "Neuer Eintrag".
- Verhalten bei geschlossener App (Cold Start) und bei App im Hintergrund (Warm Start) prüfen.
- System-Hell-/Dunkelmodus umschalten, Widget-Hintergrund auf Lesbarkeit prüfen.

`tsc --noEmit` und die bestehende Vitest-Suite bleiben unverändert grün, da keine TypeScript/JavaScript-Anwendungslogik verändert wird (reine Android-Ressourcen/Kotlin/Config-Plugin).

## Explizit nicht Teil dieses Schritts

- Keine Live-Daten im Widget (kein Status, keine Symptomwerte, keine Schub-Warnung) – reiner Schnellzugriff-Button, wie abgestimmt.
- Kein iOS-Widget (Roadmap-Punkt 12 war explizit "Android-Homescreen-Widget").
- Keine periodischen Updates (`updatePeriodMillis="0"`), da keine sich ändernden Inhalte angezeigt werden.
- Keine Anpassung an das In-App-Theme (Standard/Dunkel/Blau-Weiß) – nur System-Hell/Dunkel-Anpassung.
- Keine größenveränderbare/mehrstufige Widget-Variante (`resizeMode="none"`, feste 1x1-Größe).

---

*Hinweis: Diese App ersetzt keine ärztliche Beratung. Diese Spec betrifft ausschließlich eine technische Homescreen-Zugriffsfunktion, keine medizinische Bewertung oder Empfehlung.*
