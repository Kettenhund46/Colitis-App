# Colitis2Go – Design: Schub-Frühwarnung

*Status: Vom Nutzer (Adrian) genehmigt am 2026-07-22*
*Grundlage: bestehende Kalender-Bewertungslogik (`src/features/diary/calendarLogic.ts`), zehntes Element der Offline-Feature-Roadmap*

## Kontext & Ziel

Die Kalenderübersicht im Tagebuch bewertet bereits jeden Tag als "gut", "mittel" oder "schub-verdächtig" (rot), basierend auf Schmerzlevel, Stuhlgang-Häufigkeit und Blut im Stuhl. Diese Bewertung wird aktuell nur passiv angezeigt – der Nutzer muss selbst den Kalender öffnen und die Häufung roter Tage bemerken. Ziel dieses Schritts: eine proaktive Warnung, die den Nutzer beim Öffnen des Tagebuch-Tabs auf eine Häufung schub-verdächtiger Tage hinweist.

**Wichtige Einschränkung:** Die App hat keine Hintergrundausführung. Die Erkennung kann nur laufen, wenn die App geöffnet und der Tagebuch-Tab fokussiert wird – es gibt keine automatische Push-Benachrichtigung, die unabhängig vom App-Öffnen ausgelöst wird. Das ist mit dem Nutzer abgestimmt und bewusst so gewählt (kein zusätzlicher Aufwand für Background-Tasks).

## 1. Erkennungslogik

Neue reine Funktion in `src/features/diary/flareWarning.ts`:

```typescript
export function shouldShowFlareWarning(entries: DiaryEntryWithTriggers[], referenceDate: Date): boolean
```

- Prüft die letzten 7 Kalendertage (einschließlich `referenceDate`), zählt, an wie vielen dieser Tage mindestens ein Eintrag vorliegt und `rateDayEntries(...)` für diesen Tag `'bad'` ergibt.
- Nutzt dafür die bereits vorhandenen Funktionen `groupEntriesByDay`, `rateDayEntries` und `formatDateKey` aus `src/features/diary/calendarLogic.ts` – keine neue Bewertungslogik, keine Duplikation der bestehenden Schwellenwerte (Blut, Schmerzlevel ≥7, Stuhlgang ≥8).
- Tage müssen nicht aufeinanderfolgen – jeder schub-verdächtige Tag innerhalb der letzten 7 Tage zählt, unabhängig von seiner Position.
- Gibt `true` zurück, sobald mindestens 3 solcher Tage im 7-Tage-Fenster liegen, sonst `false`.

## 2. Banner-Komponente

Neue Komponente `src/features/diary/components/FlareWarningBanner.tsx`, gleiches Grundmuster wie das bestehende `src/features/toilets/components/LocationPermissionBanner.tsx`:

```typescript
interface FlareWarningBannerProps {
  onDismiss: () => void;
}
```

- Zeigt den Text: "Mehrere schub-verdächtige Tage in der letzten Woche – ziehe in Erwägung, deinen Arzt zu kontaktieren."
- Schließen-Button ("×") oben rechts, ruft `onDismiss` auf.
- Optik: roter Rand (`colors.danger`, `borderBottomWidth: 2`) zur klaren Unterscheidung vom neutralen Fehlerbanner, Hintergrund `colors.surface`, Text `colors.textPrimary` – gleiches Farbschema wie die bestehenden Banner-Komponenten, funktioniert in allen drei Themes.

## 3. Einbindung im Tagebuch-Tab

`app/(tabs)/tagebuch/index.tsx`:

- Neuer lokaler State `isFlareWarningDismissed` (`useState(false)`) – reiner Komponenten-State, keine Persistierung. Das erfüllt die abgestimmte Anforderung "verschwindet für die aktuelle Sitzung, erscheint aber beim nächsten App-Start wieder": ein App-Neustart erzeugt einen frischen JavaScript-Prozess und damit automatisch einen zurückgesetzten State, ganz ohne zusätzlichen Speicher-Code.
- Nach dem Laden der Einträge wird `shouldShowFlareWarning(entries, new Date())` ausgewertet. Ist das Ergebnis `true` und `isFlareWarningDismissed` ist `false`, erscheint `<FlareWarningBanner onDismiss={() => setIsFlareWarningDismissed(true)} />` oberhalb des bestehenden Fehlerbanners.
- Wechselt der Nutzer den Tab und kommt zurück (`useFocusEffect` feuert erneut), bleibt `isFlareWarningDismissed` unverändert (React-State übersteht das erneute Fokussieren, solange die Komponente nicht unmounted wird) – das Banner bleibt also innerhalb der App-Sitzung weggeklickt, wie abgestimmt.

## 4. Fehlerbehandlung

- Keine Einträge vorhanden → `shouldShowFlareWarning` gibt `false` zurück (kein Tag kann `'bad'` sein ohne Einträge), kein Sonderfall nötig.
- Einträge vorhanden, aber alle älter als 7 Tage → zählen nicht mit, Banner erscheint nicht.

## 5. Testing-Ansatz

- Unit-Tests (Vitest) für `shouldShowFlareWarning`: genau 3 schub-verdächtige Tage innerhalb der letzten 7 Tage → `true`; nur 2 → `false`; ein zusätzlicher schub-verdächtiger Tag außerhalb des 7-Tage-Fensters (z. B. vor 10 Tagen) zählt nicht mit; die Tage müssen nicht aufeinanderfolgen (z. B. Tag 1, 4, 7 zählen zusammen); leere Eingabe → `false`.
- UI-Komponente (`FlareWarningBanner.tsx`, Einbindung in `tagebuch/index.tsx`) wie bei den bisherigen Features nicht automatisiert testbar – Verifikation über `tsc --noEmit` und manuellen Test (Banner erscheint bei entsprechenden Testdaten, Schließen-Button funktioniert, Banner bleibt nach Wegklicken für die Sitzung verschwunden, erscheint nach App-Neustart wieder, alle drei Themes).

## Explizit nicht Teil dieses Schritts

- Keine Push-Benachrichtigung im Hintergrund (technisch nicht möglich ohne Background-Task-Infrastruktur, die diese App aktuell nicht hat).
- Keine konfigurierbaren Schwellenwerte durch den Nutzer (7-Tage-Fenster und 3-Tage-Schwelle sind fest im Code hinterlegt, wie bei den Kalender-Schwellenwerten zuvor).
- Keine dauerhafte Speicherung des "weggeklickt"-Zustands über einen App-Neustart hinaus (bewusst so gewählt, damit die Warnung nicht dauerhaft verschwindet, falls der Zustand anhält).

---

*Hinweis: Diese App ersetzt keine ärztliche Beratung. Diese Spec betrifft ausschließlich eine technische Auswertungs-/Hinweisfunktion auf Basis bereits erfasster Daten, keine medizinische Diagnose oder Empfehlung – der Hinweistext formuliert dies bewusst als Anregung ("ziehe in Erwägung"), nicht als Aufforderung.*
