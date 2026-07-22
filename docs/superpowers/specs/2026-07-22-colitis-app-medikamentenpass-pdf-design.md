# Colitis2Go – Design: Medikamenten-Pass PDF

*Status: Vom Nutzer (Adrian) genehmigt am 2026-07-22*
*Grundlage: bestehendes Medikamente-Feature (`src/features/medications/`) und bestehender Tagebuch-PDF-Export (`src/features/diary/diaryPdfBuilder.ts`/`diaryPdfExport.ts`), neuntes Element der Offline-Feature-Roadmap*

## Kontext & Ziel

Der Medikamente-Bereich zeigt aktuell nur eine In-App-Liste, aber es gibt keine Möglichkeit, eine kompakte Übersicht der aktuellen Medikation z. B. für einen Arztbesuch mitzunehmen. Ziel dieses Schritts: ein PDF-Export ("Medikamenten-Pass"), der ausschließlich die aktuell aktiven Medikamente mit den wichtigsten Angaben auflistet – gleicher technischer Ansatz wie der bereits bestehende Tagebuch-PDF-Export (`expo-print` + `expo-sharing`, keine neue Abhängigkeit).

## 1. HTML-Builder

Neue Datei `src/features/medications/medicationPassBuilder.ts`, gleiches Muster wie `src/features/diary/diaryPdfBuilder.ts` (eigenes `escapeHtml`, Inline-`<style>`, deutsche Beschriftung).

```typescript
export function buildMedicationPassHtml(medications: Medication[], today: Date): string
```

- Filtert `medications` auf aktive Einträge über die bereits vorhandene `isMedicationActive(endDate, today)`-Funktion aus `../medications/medicationStatus` – beendete Medikamente erscheinen nicht im Pass.
- Pro aktivem Medikament: Name (als Überschrift), Dosis, Einnahmeschema, "Seit TT.MM.JJJJ" (Startdatum, deutsch formatiert über eine neue kleine Hilfsfunktion `formatMedicationStartDate(startDate: string): string`, die den bereits vorhandenen `JJJJ-MM-TT`-String direkt in Teile zerlegt – keine `Date`-Objekt-Konstruktion nötig, vermeidet Zeitzonen-Fallstricke wie bei den Kalender-/Verlaufs-Features zuvor).
- Keine Nebenwirkungs-Notiz, keine Erinnerungszeiten (bewusst nicht enthalten, siehe unten).
- Keine aktiven Medikamente vorhanden → Hinweistext "Keine aktiven Medikamente vorhanden." statt der Liste (analog zum Tagebuch-PDF bei leerer Eingabe).
- Kopfzeile: Titel "Medikamenten-Pass" + "Erstellt am TT.MM.JJJJ" (heutiges Datum), gleiches Muster wie im Tagebuch-PDF.

## 2. Export-Funktion

Neue Datei `src/features/medications/medicationPassExport.ts`, identisches Muster wie `src/features/diary/diaryPdfExport.ts`:

```typescript
export async function exportMedicationPass(medications: Medication[]): Promise<void>
```

Baut das HTML über `buildMedicationPassHtml(medications, new Date())`, schreibt es über `Print.printToFileAsync` in eine temporäre PDF-Datei und teilt sie über `Sharing.shareAsync` (MIME `application/pdf`, UTI `com.adobe.pdf`), inklusive derselben Fehlerbehandlung, falls Teilen auf dem Gerät nicht verfügbar ist.

## 3. Einbindung

`app/(tabs)/medikamente/index.tsx`: neuer Button "Medikamenten-Pass als PDF exportieren" oberhalb der `MedicationList` (gleiche Position/Optik wie der bestehende PDF-Export-Link im Tagebuch-Tab), mit eigenem `isExporting`-Zustand. Der Button ist deaktiviert, wenn `medications.length === 0` (gar keine Medikamente erfasst) – ist mindestens ein (auch beendetes) Medikament vorhanden, bleibt der Button aktiv, auch wenn aktuell keine aktiven Medikamente existieren (in dem Fall zeigt das PDF selbst den Hinweistext aus Abschnitt 1).

## 4. Fehlerbehandlung

- Teilen auf dem Gerät nicht verfügbar → gleiche Fehlermeldung/-behandlung wie beim bestehenden Tagebuch-PDF-Export (Fehlertext in der bestehenden Error-Banner-Anzeige der Seite).
- Nur beendete Medikamente vorhanden (keine aktiven) → PDF wird trotzdem erzeugt, zeigt aber den Hinweistext statt einer leeren Liste.

## 5. Testing-Ansatz

- Unit-Tests (Vitest) für `buildMedicationPassHtml`: nur aktive Medikamente erscheinen im HTML, beendete Medikamente werden ausgeschlossen, Startdatum wird korrekt zu `TT.MM.JJJJ` formatiert, leere/nur-beendete Liste zeigt den Hinweistext.
- Unit-Tests für `formatMedicationStartDate`: korrekte Umwandlung von `JJJJ-MM-TT` zu `TT.MM.JJJJ`.
- UI-Änderung (neuer Button in `medikamente/index.tsx`) wie bei den bisherigen Features nicht automatisiert testbar – Verifikation über `tsc --noEmit` und manuellen Test (Export mit aktiven Medikamenten, Export ohne aktive Medikamente, Button deaktiviert bei komplett leerer Liste).

## Explizit nicht Teil dieses Schritts

- Keine Nebenwirkungs-Notiz und keine Erinnerungszeiten im PDF (bewusst auf die medizinisch relevanten Kernangaben beschränkt, wie abgestimmt).
- Keine beendeten Medikamente im Pass (nur aktuelle Medikation, wie abgestimmt).
- Kein Patientenname oder sonstige Personendaten im PDF – die App speichert aktuell kein Nutzerprofil, daher wird keins hinzugefügt.

---

*Hinweis: Diese App ersetzt keine ärztliche Beratung. Diese Spec betrifft ausschließlich eine technische Exportfunktion auf Basis bereits erfasster Daten, keine medizinische Bewertung oder Empfehlung.*
