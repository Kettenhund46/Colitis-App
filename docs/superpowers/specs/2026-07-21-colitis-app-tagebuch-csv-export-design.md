# Colitis2Go – Design: Tagebuch CSV-Export

*Status: Vom Nutzer (Adrian) genehmigt am 2026-07-21*
*Grundlage: bestehender PDF-Export (`src/features/diary/diaryPdfExport.ts`, `diaryPdfBuilder.ts`), zweites Element aus dem Brainstorming vom 2026-07-21*

## Kontext & Ziel

Der Tagebuch-Tab kann Einträge bereits als PDF exportieren (für Arztgespräche gedacht, lesbar formatiert). Für die eigene Auswertung in Excel ist ein PDF unpraktisch. Ziel dieses Schritts: ein zusätzlicher CSV-Export derselben Tagebucheinträge, direkt in deutschem Excel per Doppelklick sauber in Spalten nutzbar.

## 1. CSV-Format

**Trennzeichen:** Semikolon (`;`) statt Komma — deutsches Excel interpretiert eine Komma-getrennte Datei beim Doppelklick sonst als eine einzige Spalte, weil Komma dort als Dezimaltrennzeichen gilt.

**Kodierung:** UTF-8 mit BOM (Byte Order Mark) vorangestellt, damit Excel Umlaute (ä, ö, ü, ß) korrekt erkennt statt sie falsch zu interpretieren.

**Spalten (eine Zeile pro Tagebucheintrag, erste Zeile = deutsche Kopfzeile):**

| Spalte | Inhalt | Quelle |
|---|---|---|
| Datum | formatiert wie im PDF (`formatOccurredAt`) | `entry.occurredAt` |
| Stuhlgang-Häufigkeit | Zahl | `entry.stoolFrequency` |
| Konsistenz | Klartext-Label | `labelFor(STOOL_CONSISTENCY_OPTIONS, entry.stoolConsistency)` |
| Schmerzlevel | Zahl (0–10) | `entry.painLevel` |
| Blut im Stuhl | „Ja" / „Nein" | `entry.hasBlood` |
| Auslöser | Klartext-Labels, mehrere durch Komma **innerhalb der Zelle** getrennt | `entry.triggerCategories` |
| Symptome | Klartext-Labels, mehrere durch Komma **innerhalb der Zelle** getrennt | `entry.symptoms` |
| Notiz | Freitext, leer wenn keine Notiz vorhanden | `entry.note` |

**CSV-Escaping:** Eine generische Escaping-Funktion wird auf **jedes** Feld angewendet, bevor es in die Zeile eingefügt wird (nicht nur auf die Notiz) — einfacher und sicherer, als vorab zu entscheiden, welche Felder es brauchen. Enthält ein Feld ein Semikolon, doppelte Anführungszeichen oder einen Zeilenumbruch, wird es komplett in doppelte Anführungszeichen gesetzt; enthaltene Anführungszeichen werden dabei verdoppelt (Standard-CSV-Escaping, RFC 4180). In der Praxis greift das nur bei der Notiz — Zahlen, „Ja"/„Nein" und die aus festen Options-Listen stammenden Klartext-Labels (Konsistenz, Auslöser, Symptome) enthalten nie eines dieser Zeichen.

**Keine Einträge vorhanden:** Die Datei enthält dann nur die Kopfzeile, kein Fehler.

## 2. Datei-Erzeugung & Teilen

Analog zum bestehenden Muster aus `src/features/backup/backupFileService.ts` (nicht zum PDF-Weg, der über `expo-print` läuft):

1. Verzeichnis im Cache anlegen (`idempotent: true`).
2. Datei `tagebuch-export-JJJJ-MM-TT.csv` (heutiges Datum) mit dem CSV-Inhalt (BOM + Zeilen) beschreiben.
3. Über den System-Teilen-Dialog (`expo-sharing`) anbieten, MIME-Type `text/csv`.
4. Danach die temporäre Datei löschen (`finally`-Block, wie beim Backup-Export).
5. Ist Teilen auf dem Gerät nicht verfügbar, wird ein Fehler geworfen mit derselben Meldung wie beim bestehenden PDF-/Backup-Export ("Teilen ist auf diesem Gerät nicht verfügbar.").

## 3. UI

Im Tagebuch-Tab (`app/(tabs)/tagebuch/index.tsx`), direkt neben dem bestehenden "Als PDF exportieren"-Link, ein zweiter Link "Als CSV exportieren" mit identischem Verhalten: während des Exports "CSV wird erstellt …", deaktiviert wenn `entries.length === 0` oder gerade ein Export läuft (beide Export-Buttons teilen sich denselben `isExporting`-Zustand, analog zum bestehenden Muster — ein CSV- und ein PDF-Export gleichzeitig ergibt ohnehin keinen Sinn).

## 4. Fehlerbehandlung

- Teilen-Dialog nicht verfügbar → Fehlermeldung, kein Absturz (wie beim PDF-Export)
- Datei-Schreibfehler → Fehlermeldung "CSV-Export fehlgeschlagen.", `isExporting` wird zurückgesetzt

## 5. Testing-Ansatz

- Unit-Tests (Vitest) für `buildDiaryCsv`: korrekte Kopfzeile, korrekte Werte-Zuordnung pro Spalte, Semikolon als Trenner, Komma-Verknüpfung bei mehreren Auslösern/Symptomen, „Ja"/„Nein" für Blut, CSV-Escaping bei einer Notiz mit Semikolon/Anführungszeichen/Zeilenumbruch, leere Kopfzeile-only-Ausgabe bei leerer Eintragsliste, UTF-8-BOM als erstes Zeichen des Ergebnisses.
- Wie beim bestehenden PDF-/Backup-Export nicht sinnvoll automatisiert testbar: der native Teilen-Dialog und das tatsächliche Dateisystem-Schreiben (`expo-file-system`) — Verifikation über `tsc --noEmit` und manuellen Test (Export antippen, Datei in einer Excel- oder Tabellen-App öffnen und Spalten/Umlaute prüfen).

## Explizit nicht Teil dieses Schritts

- Auswahl/Filterung, welche Einträge exportiert werden (immer alle, wie beim PDF-Export)
- Konfigurierbares Trennzeichen oder Spaltenauswahl
- CSV-Import (nur Export)

---

*Hinweis: Diese App ersetzt keine ärztliche Beratung. Diese Spec betrifft ausschließlich eine technische Exportfunktion, keine medizinischen Inhalte.*
