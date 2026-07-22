# Android-Homescreen-Widget Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ein natives Android-Homescreen-Widget (1x1, statisches Icon) lässt sich zum Homescreen hinzufügen; ein Tap öffnet die App direkt auf dem "Neuer Eintrag"-Bildschirm des Tagebuchs.

**Architecture:** Ein neuer Expo-Config-Plugin (`plugins/withNewDiaryEntryWidget.js`), nach dem Muster des bestehenden `plugins/withNearestToiletShortcut.js`, schreibt beim Prebuild native Android-Ressourcen (Kotlin-`AppWidgetProvider`, Layout-XML, Widget-Info-XML, Farb-/String-Ressourcen, Icon) in den generierten `android/`-Projektbaum und ergänzt den nötigen `<receiver>`-Eintrag im `AndroidManifest.xml`. Der Tap-Handler nutzt den bereits im Projekt etablierten Deep-Link-Mechanismus (`colitisapp://...`), keine neue JS/TS-Logik nötig.

**Tech Stack:** Expo Config Plugins (`expo/config-plugins`), Kotlin (Android `AppWidgetProvider`), Android-XML-Ressourcen. Keine neuen npm-Abhängigkeiten.

## Global Constraints

- Referenz: `docs/superpowers/specs/2026-07-22-colitis-app-android-homescreen-widget-design.md`
- Kein Datenzugriff, keine Live-Inhalte im Widget – rein statischer Tap-to-open-Button (`updatePeriodMillis="0"`, `resizeMode="none"`, feste 1x1-Größe).
- Deep-Link-Ziel: `colitisapp://tagebuch/neu` (öffnet den bestehenden Bildschirm `app/(tabs)/tagebuch/neu.tsx` über expo-router, kein Zwischenbildschirm nötig).
- Icon: wiederverwendet das bereits vorhandene `assets/images/android-icon-monochrome.png` (kein neuer Asset).
- Widget-Hintergrund folgt System-Hell/Dunkel über `values`/`values-night`-Ressourcenqualifizierer, unabhängig vom In-App-Theme.
- Android-Package: `com.anonymous.colitisapp` (aus `app.json` → `expo.android.package`).
- Die generierte `android/`-Verzeichnisstruktur ist gitignored (`/android` in `.gitignore`) – native Dateien werden ausschließlich über den Config-Plugin zur Prebuild-Zeit erzeugt, nie direkt ins Repo geschrieben.
- Kein Kotlin/Gradle-Änderungsbedarf über den Plugin hinaus: Expo-Projekte generieren bereits Kotlin-fähige Android-Projekte (`MainActivity.kt` existiert bereits), eine einzelne zusätzliche `.kt`-Datei im selben Package braucht keine weitere Gradle-Konfiguration.
- Verifikation dieses Plans erfolgt über `npx.cmd expo prebuild --platform android --clean` (aus `colitis-app/`) plus Inspektion der generierten Dateien – **kein** vollständiger Gradle-Build (`./gradlew assembleDebug`) ist Teil dieses Plans (fehlende Android-SDK-Toolchain in der Ausführungsumgebung ist zu erwarten; der tatsächliche Kompilier-/Laufzeit-Test erfolgt später über einen EAS-Development-Build durch den Nutzer, wie in der Spec unter "Testing-Ansatz" beschrieben).
- Die neue Datei `plugins/withNewDiaryEntryWidget.js` ist reines `.js` (CommonJS, wie `withNearestToiletShortcut.js`) und liegt außerhalb von `tsconfig.json`s `include` (`**/*.ts`, `**/*.tsx`) – `npx.cmd tsc --noEmit --pretty false` prüft sie nicht mit, das ist erwartet und kein Fehler.
- `npx.cmd vitest run` (aus `colitis-app/`) muss durchgehend grün bleiben – dieser Plan ändert keine TypeScript/JavaScript-Anwendungslogik, die von der bestehenden Suite abgedeckt wird.
- Windows-Umgebung: `npx.cmd`, nicht `npx`.
- `AGENTS.md` beachten: Expo SDK 57 Doku unter https://docs.expo.dev/versions/v57.0.0/ ist maßgeblich für Config-Plugin-APIs (`expo/config-plugins`).

---

### Task 1: Config-Plugin – native Ressourcen (Kotlin, Layout, Widget-Info, Farben, Icon)

**Files:**
- Create: `colitis-app/plugins/withNewDiaryEntryWidget.js`

**Interfaces:**
- Consumes: nichts aus vorherigen Tasks (erster Task). Liest zur Laufzeit `config.android.package` aus der bestehenden `app.json` (bereits gesetzt: `com.anonymous.colitisapp`) und kopiert `assets/images/android-icon-monochrome.png` (bereits vorhanden).
- Produces (für Task 2):
  - `module.exports = function withNewDiaryEntryWidget(config)` – die Haupt-Plugin-Funktion, die Task 2 um eine weitere interne Funktion (`withNewDiaryEntryWidgetManifest`) erweitert und in dieselbe Kompositionskette einhängt.
  - Erzeugt bei jedem `expo prebuild` folgende Dateien im generierten `android/`-Baum: `res/values/widget_colors.xml`, `res/values-night/widget_colors.xml`, `res/values/widget_strings.xml`, `res/drawable/widget_background.xml`, `res/drawable/widget_new_diary_entry_icon.png`, `res/layout/widget_new_diary_entry.xml`, `res/xml/new_diary_entry_widget_info.xml`, `app/src/main/java/com/anonymous/colitisapp/NewDiaryEntryWidgetProvider.kt`.

Dieser Task hat keine Vitest-Abdeckung (reiner Config-Plugin-Code für native Android-Ressourcen, gleiches Muster wie das bereits ungetestete `withNearestToiletShortcut.js`). Verifikation erfolgt über `expo prebuild` + Dateiinspektion in Schritt 2.

- [ ] **Step 1: Config-Plugin-Datei mit Ressourcen-Erzeugung schreiben**

Create `colitis-app/plugins/withNewDiaryEntryWidget.js`:

```javascript
const { withDangerousMod } = require('expo/config-plugins');
const fs = require('fs');
const path = require('path');

const WIDGET_PROVIDER_CLASS_NAME = 'NewDiaryEntryWidgetProvider';
const DEEP_LINK_URL = 'colitisapp://tagebuch/neu';

function withNewDiaryEntryWidgetResources(config) {
  return withDangerousMod(config, [
    'android',
    async (config) => {
      const packageName = config.android && config.android.package;
      if (!packageName) {
        throw new Error('withNewDiaryEntryWidget: android.package ist in app.json nicht gesetzt.');
      }

      const androidRoot = config.modRequest.platformProjectRoot;
      const resRoot = path.join(androidRoot, 'app/src/main/res');

      const valuesDir = path.join(resRoot, 'values');
      fs.mkdirSync(valuesDir, { recursive: true });
      fs.writeFileSync(
        path.join(valuesDir, 'widget_colors.xml'),
        `<?xml version="1.0" encoding="utf-8"?>
<resources>
  <color name="widget_background_color">#E6F4FE</color>
</resources>
`,
        'utf-8'
      );
      fs.writeFileSync(
        path.join(valuesDir, 'widget_strings.xml'),
        `<?xml version="1.0" encoding="utf-8"?>
<resources>
  <string name="widget_new_diary_entry_label">Neuer Tagebucheintrag</string>
  <string name="widget_new_diary_entry_description">Neuer Tagebucheintrag</string>
</resources>
`,
        'utf-8'
      );

      const valuesNightDir = path.join(resRoot, 'values-night');
      fs.mkdirSync(valuesNightDir, { recursive: true });
      fs.writeFileSync(
        path.join(valuesNightDir, 'widget_colors.xml'),
        `<?xml version="1.0" encoding="utf-8"?>
<resources>
  <color name="widget_background_color">#2A2A2A</color>
</resources>
`,
        'utf-8'
      );

      const drawableDir = path.join(resRoot, 'drawable');
      fs.mkdirSync(drawableDir, { recursive: true });
      fs.writeFileSync(
        path.join(drawableDir, 'widget_background.xml'),
        `<?xml version="1.0" encoding="utf-8"?>
<shape xmlns:android="http://schemas.android.com/apk/res/android">
  <solid android:color="@color/widget_background_color" />
  <corners android:radius="16dp" />
</shape>
`,
        'utf-8'
      );

      const iconSource = path.join(config.modRequest.projectRoot, 'assets/images/android-icon-monochrome.png');
      fs.copyFileSync(iconSource, path.join(drawableDir, 'widget_new_diary_entry_icon.png'));

      const layoutDir = path.join(resRoot, 'layout');
      fs.mkdirSync(layoutDir, { recursive: true });
      fs.writeFileSync(
        path.join(layoutDir, 'widget_new_diary_entry.xml'),
        `<?xml version="1.0" encoding="utf-8"?>
<FrameLayout xmlns:android="http://schemas.android.com/apk/res/android"
    android:layout_width="match_parent"
    android:layout_height="match_parent"
    android:background="@drawable/widget_background">

    <ImageView
        android:id="@+id/widget_icon"
        android:layout_width="32dp"
        android:layout_height="32dp"
        android:layout_gravity="center"
        android:src="@drawable/widget_new_diary_entry_icon"
        android:contentDescription="@string/widget_new_diary_entry_description" />

</FrameLayout>
`,
        'utf-8'
      );

      const xmlDir = path.join(resRoot, 'xml');
      fs.mkdirSync(xmlDir, { recursive: true });
      fs.writeFileSync(
        path.join(xmlDir, 'new_diary_entry_widget_info.xml'),
        `<?xml version="1.0" encoding="utf-8"?>
<appwidget-provider xmlns:android="http://schemas.android.com/apk/res/android"
    android:minWidth="40dp"
    android:minHeight="40dp"
    android:targetCellWidth="1"
    android:targetCellHeight="1"
    android:updatePeriodMillis="0"
    android:resizeMode="none"
    android:widgetCategory="home_screen"
    android:initialLayout="@layout/widget_new_diary_entry" />
`,
        'utf-8'
      );

      const javaDir = path.join(androidRoot, 'app/src/main/java', packageName.replace(/\./g, '/'));
      fs.mkdirSync(javaDir, { recursive: true });
      fs.writeFileSync(
        path.join(javaDir, `${WIDGET_PROVIDER_CLASS_NAME}.kt`),
        `package ${packageName}

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.widget.RemoteViews

class ${WIDGET_PROVIDER_CLASS_NAME} : AppWidgetProvider() {
    override fun onUpdate(context: Context, appWidgetManager: AppWidgetManager, appWidgetIds: IntArray) {
        for (appWidgetId in appWidgetIds) {
            val intent = Intent(Intent.ACTION_VIEW, Uri.parse("${DEEP_LINK_URL}"))
            val pendingIntent = PendingIntent.getActivity(
                context,
                0,
                intent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )

            val views = RemoteViews(context.packageName, R.layout.widget_new_diary_entry)
            views.setOnClickPendingIntent(R.id.widget_icon, pendingIntent)

            appWidgetManager.updateAppWidget(appWidgetId, views)
        }
    }
}
`,
        'utf-8'
      );

      return config;
    },
  ]);
}

module.exports = function withNewDiaryEntryWidget(config) {
  config = withNewDiaryEntryWidgetResources(config);
  return config;
};

module.exports.WIDGET_PROVIDER_CLASS_NAME = WIDGET_PROVIDER_CLASS_NAME;
```

Hinweis: Der letzte Export (`module.exports.WIDGET_PROVIDER_CLASS_NAME`) macht den Klassennamen für Task 2 wiederverwendbar, ohne ihn dort erneut hart zu kodieren – Task 2 fügt seine Manifest-Funktion in dieselbe Datei ein und importiert nichts von außen, sondern erweitert diese Datei direkt (siehe Task 2, Schritt 1).

- [ ] **Step 2: Node-Syntax-Check**

Run (aus `colitis-app/`): `node -e "require('./plugins/withNewDiaryEntryWidget.js')"`
Expected: Kein Fehler (keine Ausgabe) – bestätigt, dass die Datei syntaktisch gültiges CommonJS ist, bevor sie in `app.json` registriert wird (Registrierung folgt erst in Task 2).

- [ ] **Step 3: Commit**

```bash
git add colitis-app/plugins/withNewDiaryEntryWidget.js
git commit -m "feat: Config-Plugin fuer Homescreen-Widget-Ressourcen anlegen"
```

---

### Task 2: Manifest-Receiver, Plugin-Registrierung und Prebuild-Verifikation

**Files:**
- Modify: `colitis-app/plugins/withNewDiaryEntryWidget.js`
- Modify: `colitis-app/app.json`

**Interfaces:**
- Consumes: `WIDGET_PROVIDER_CLASS_NAME` und die in Task 1 erzeugten Ressourcen (`@xml/new_diary_entry_widget_info`, `@string/widget_new_diary_entry_label`) aus derselben Datei.
- Produces: nichts für weitere Tasks – letzter Task dieses Plans.

Dieser Task macht das Widget tatsächlich installierbar: ohne den `<receiver>`-Eintrag im Manifest würde Android das Widget trotz vorhandener Ressourcen nicht in der Widget-Auswahl anzeigen.

- [ ] **Step 1: Manifest-Funktion ergänzen**

In `colitis-app/plugins/withNewDiaryEntryWidget.js`, ändere die erste Zeile:

```javascript
const { withDangerousMod } = require('expo/config-plugins');
```

zu:

```javascript
const { withAndroidManifest, withDangerousMod } = require('expo/config-plugins');
```

Füge nach der bestehenden `withNewDiaryEntryWidgetResources`-Funktion (vor `module.exports = function withNewDiaryEntryWidget(config) {`) eine neue Funktion ein:

```javascript
function withNewDiaryEntryWidgetManifest(config) {
  return withAndroidManifest(config, (config) => {
    const androidManifest = config.modResults;
    const application = androidManifest.manifest.application[0];

    application.receiver = application.receiver || [];

    const alreadyPresent = application.receiver.some(
      (receiver) => receiver.$ && receiver.$['android:name'] === `.${WIDGET_PROVIDER_CLASS_NAME}`
    );

    if (!alreadyPresent) {
      application.receiver.push({
        $: {
          'android:name': `.${WIDGET_PROVIDER_CLASS_NAME}`,
          'android:exported': 'true',
          'android:label': '@string/widget_new_diary_entry_label',
        },
        'intent-filter': [
          {
            action: [{ $: { 'android:name': 'android.appwidget.action.APPWIDGET_UPDATE' } }],
          },
        ],
        'meta-data': [
          {
            $: {
              'android:name': 'android.appwidget.provider',
              'android:resource': '@xml/new_diary_entry_widget_info',
            },
          },
        ],
      });
    }

    return config;
  });
}
```

Ändere den bestehenden Export-Block am Dateiende von:

```javascript
module.exports = function withNewDiaryEntryWidget(config) {
  config = withNewDiaryEntryWidgetResources(config);
  return config;
};

module.exports.WIDGET_PROVIDER_CLASS_NAME = WIDGET_PROVIDER_CLASS_NAME;
```

zu:

```javascript
module.exports = function withNewDiaryEntryWidget(config) {
  config = withNewDiaryEntryWidgetResources(config);
  config = withNewDiaryEntryWidgetManifest(config);
  return config;
};

module.exports.WIDGET_PROVIDER_CLASS_NAME = WIDGET_PROVIDER_CLASS_NAME;
```

- [ ] **Step 2: Node-Syntax-Check**

Run (aus `colitis-app/`): `node -e "require('./plugins/withNewDiaryEntryWidget.js')"`
Expected: Kein Fehler.

- [ ] **Step 3: Plugin in `app.json` registrieren**

In `colitis-app/app.json`, ändere im `expo.plugins`-Array:

```json
      "./plugins/withNearestToiletShortcut",
      "expo-sharing",
```

zu:

```json
      "./plugins/withNearestToiletShortcut",
      "./plugins/withNewDiaryEntryWidget",
      "expo-sharing",
```

- [ ] **Step 4: Prebuild ausführen und generierte Dateien verifizieren**

Run (aus `colitis-app/`): `npx.cmd expo prebuild --platform android --clean`
Expected: Läuft ohne Fehler durch (erzeugt/überschreibt den lokalen `android/`-Ordner komplett neu).

Danach prüfen, dass folgende Dateien existieren und die erwarteten Kern-Inhalte enthalten (aus `colitis-app/`):

```bash
test -f android/app/src/main/res/layout/widget_new_diary_entry.xml && echo "layout OK"
test -f android/app/src/main/res/xml/new_diary_entry_widget_info.xml && echo "widget-info OK"
test -f android/app/src/main/res/drawable/widget_new_diary_entry_icon.png && echo "icon OK"
test -f android/app/src/main/res/values/widget_colors.xml && echo "colors light OK"
test -f android/app/src/main/res/values-night/widget_colors.xml && echo "colors night OK"
test -f "android/app/src/main/java/com/anonymous/colitisapp/NewDiaryEntryWidgetProvider.kt" && echo "kotlin OK"
grep -q "NewDiaryEntryWidgetProvider" android/app/src/main/AndroidManifest.xml && echo "manifest receiver OK"
grep -q "colitisapp://tagebuch/neu" "android/app/src/main/java/com/anonymous/colitisapp/NewDiaryEntryWidgetProvider.kt" && echo "deep link OK"
```

Expected: Alle sieben Prüfungen geben ihre jeweilige `"... OK"`-Zeile aus.

- [ ] **Step 5: Bestehende Test-Suite und Type-Check gegenprüfen**

Run (aus `colitis-app/`): `npx.cmd vitest run` und `npx.cmd tsc --noEmit --pretty false`
Expected: Beide unverändert grün (dieser Plan ändert keine TypeScript/JavaScript-Anwendungslogik).

- [ ] **Step 6: Manueller Geräte-Test (Checkliste für einen späteren Development-Build)**

Dieser Schritt kann nicht in der aktuellen Ausführungsumgebung durchgeführt werden (kein Android-Gerät/Emulator, kein vollständiger Gradle-Build als Teil dieses Plans – siehe Global Constraints). Er ist als Checkliste für den Nutzer nach einem neuen EAS-Development-Build zu dokumentieren, nicht selbst auszuführen:

- Widget aus der Android-Widget-Liste zum Homescreen hinzufügen, Größe/Icon-Darstellung prüfen.
- Tap auf das Widget → App öffnet sich direkt auf "Neuer Eintrag".
- Verhalten bei geschlossener App (Cold Start) und bei App im Hintergrund (Warm Start) prüfen.
- System-Hell-/Dunkelmodus umschalten, Widget-Hintergrund auf Lesbarkeit prüfen.

- [ ] **Step 7: Commit**

```bash
git add colitis-app/plugins/withNewDiaryEntryWidget.js colitis-app/app.json
git commit -m "feat: Homescreen-Widget-Plugin registrieren und Manifest-Receiver ergaenzen"
```
