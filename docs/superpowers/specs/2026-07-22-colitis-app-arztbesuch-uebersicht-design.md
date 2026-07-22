# Colitis2Go – Design: Arztbesuch-Übersicht/PDF

*Status: Vom Nutzer (Adrian) genehmigt am 2026-07-22*
*Grundlage: bestehendes Medikamente-Feature (`src/features/medications/`) als CRUD-Vorbild, bestehender PDF-Export-Ansatz (`diaryPdfBuilder.ts`/`diaryPdfExport.ts`, `medicationPassBuilder.ts`/`medicationPassExport.ts`), elftes Element der Offline-Feature-Roadmap*

## Kontext & Ziel

Die App erfasst bisher Tagebucheinträge, Medikamente und Wissensartikel, aber es gibt keine Möglichkeit, Arztbesuche selbst zu dokumentieren (Datum, Anlass, Besprochenes, Folgetermin). Ziel dieses Schritts: eine neue Verwaltung für Arztbesuche innerhalb des Tagebuch-Tabs, inklusive PDF-Export der kompletten Besuchshistorie – z. B. um einem neuen Arzt die Vorgeschichte zu zeigen.

## 1. Datenmodell & Speicherung

Neue Tabelle `doctor_visits` in `src/db/schema.ts`:

```typescript
export const doctorVisits = sqliteTable('doctor_visits', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  visitDate: text('visit_date').notNull(),
  doctorName: text('doctor_name'),
  reason: text('reason'),
  note: text('note'),
  nextAppointmentDate: text('next_appointment_date'),
});
```

- `visitDate` ist Pflicht (Format `JJJJ-MM-TT`, wie bei `medications.startDate`).
- `doctorName`, `reason`, `note`, `nextAppointmentDate` sind optional (nullable).
- Neue Drizzle-Migration wird mit `npx drizzle-kit generate` erzeugt (aktualisiert `drizzle/meta/_journal.json`, neuer Snapshot, regenerierte `drizzle/migrations.js`).

**Backup-Integration:** Da `src/features/backup/` keine generische Tabellen-Erkennung nutzt, sondern eine explizite Enumeration (`REQUIRED_TABLE_KEYS` in `backupSerializer.ts`), muss `doctorVisits` explizit ergänzt werden in:
- `src/features/backup/types.ts` (`BackupData['tables']`)
- `src/features/backup/db/backupRepository.ts` (Export- und Import-Logik)
- `src/features/backup/backupSerializer.ts` (`REQUIRED_TABLE_KEYS`)

Sonst würden Arztbesuch-Daten bei einem Restore stillschweigend verloren gehen (gleiches Muster wie zuvor bei `knowledgeFavorites`).

## 2. Feature-Struktur & Repository

Neuer Ordner `src/features/doctorVisits/`, nach dem Muster von `src/features/medications/`:

```typescript
// types.ts
export interface DoctorVisit {
  id: number;
  visitDate: string;
  doctorName: string | null;
  reason: string | null;
  note: string | null;
  nextAppointmentDate: string | null;
}

export interface DoctorVisitInput {
  visitDate: string;
  doctorName: string | null;
  reason: string | null;
  note: string | null;
  nextAppointmentDate: string | null;
}
```

- `db/doctorVisitsRepository.ts` — `createDoctorVisit`, `listDoctorVisits` (sortiert `desc(visitDate)`, wie bei Tagebucheinträgen), `getDoctorVisitById`, `updateDoctorVisit`, `deleteDoctorVisit`.
- `db/testDb.ts` — dynamischer Migrations-Test-Helper, der beim Testlauf alle `.sql`-Dateien unter `drizzle/` ausführt (gleiches Muster wie `knowledge/db/testDb.ts`).
- `formLogic.ts` — `DoctorVisitFormState`, `INITIAL_DOCTOR_VISIT_FORM_STATE`, `buildDoctorVisitInput(state): DoctorVisitInput` (trimmt Freitextfelder, leerer String → `null`, analog zu `sideEffectsNote`/`endDate` bei Medikamenten).

Volles CRUD (Anlegen, Bearbeiten, Löschen) analog zu Medikamenten und Tagebucheinträgen. Löschen mit Bestätigungsdialog (`Alert.alert`), wie an anderen Stellen der App etabliert.

## 3. UI & Navigation

Neue Stack-Screens unter `app/(tabs)/tagebuch/arztbesuche/`:

- `index.tsx` — Liste aller Besuche (neueste zuerst). Pro Eintrag: Datum, Arzt/Fachrichtung (falls vorhanden), Anlass (falls vorhanden), ggf. "Nächster Termin: TT.MM.JJJJ". Tap auf einen Eintrag öffnet die Bearbeitungsansicht. Lösch-Button je Eintrag. Floating-Add-Button (`+`) unten rechts, wie im Tagebuch-Tab.
- `neu.tsx` — Formular zum Anlegen eines neuen Besuchs (Datumsfeld Pflicht, restliche Felder optional).
- `[id].tsx` — Formular zum Bearbeiten eines bestehenden Besuchs, inkl. Löschen-Option (analog `medikamente/[id].tsx`).

`app/(tabs)/tagebuch/_layout.tsx` bekommt neue `Stack.Screen`-Einträge für `arztbesuche/index`, `arztbesuche/neu`, `arztbesuche/[id]` (Titel z. B. "Arztbesuche", "Neuer Arztbesuch", "Arztbesuch bearbeiten").

Erreichbar über einen neuen Link auf `tagebuch/index.tsx`, direkt unterhalb des bestehenden "Muster-Auswertung ansehen →"-Links, gleiche Optik (`analysisLink`-Stil):

```
"Arztbesuche verwalten →"  →  router.push('/tagebuch/arztbesuche')
```

## 4. PDF-Export

Neue Dateien nach dem etablierten Muster (`diaryPdfBuilder.ts`/`diaryPdfExport.ts`, `medicationPassBuilder.ts`/`medicationPassExport.ts`):

```typescript
// src/features/doctorVisits/doctorVisitPassBuilder.ts
export function buildDoctorVisitPassHtml(visits: DoctorVisit[], today: Date): string
```

- Zeigt die **komplette Besuchshistorie** chronologisch (neueste zuerst, wie die Listenansicht).
- Pro Besuch: Datum (`TT.MM.JJJJ`), Arzt/Fachrichtung (falls vorhanden), Anlass (falls vorhanden), Notizen (falls vorhanden), "Nächster Termin: TT.MM.JJJJ" (falls vorhanden).
- Leere Liste → Hinweistext "Keine Arztbesuche erfasst." statt der Liste (analog Tagebuch-PDF/Medikamentenpass bei leerer Eingabe).
- Eigenes lokales `escapeHtml` (kein Shared-Util – bewusst dupliziert, wie bei allen bisherigen PDF-Buildern).
- Kopfzeile: Titel "Arztbesuch-Übersicht" + "Erstellt am TT.MM.JJJJ" (heutiges Datum).

```typescript
// src/features/doctorVisits/doctorVisitPassExport.ts
export async function exportDoctorVisitPass(visits: DoctorVisit[]): Promise<void>
```

Dünner `expo-print`/`expo-sharing`-Wrapper, identisches Muster wie `medicationPassExport.ts`, kein Testfile (native Module, nicht gemockt in diesem Projekt).

Export-Button auf `arztbesuche/index.tsx` (Position/Optik wie bestehende Export-Buttons), deaktiviert wenn `visits.length === 0`.

## 5. Fehlerbehandlung

- Laden/Speichern/Löschen-Fehler zeigen eine Fehlermeldung im bestehenden Error-Banner-Muster der Seite (wie bei Medikamenten/Tagebuch).
- PDF-Teilen auf dem Gerät nicht verfügbar → gleiche Fehlerbehandlung wie bei den bisherigen PDF-Exports.
- Keine Arztbesuche vorhanden → Liste zeigt einen Leerzustand-Hinweistext statt einer leeren Liste; Export-Button ist deaktiviert.

## 6. Testing-Ansatz

- Unit-Tests (Vitest) für `doctorVisitsRepository.ts`: Anlegen, Lesen (Liste sortiert neueste zuerst), Einzelabruf, Aktualisieren, Löschen.
- Unit-Tests für `formLogic.ts`: `buildDoctorVisitInput` trimmt Freitext und wandelt leere Strings in `null`, Pflichtfeld `visitDate` bleibt erhalten.
- Unit-Tests für `doctorVisitPassBuilder.ts`: alle Felder korrekt gerendert, optionale Felder werden bei `null` ausgeblendet, leere Liste zeigt Hinweistext, Datum korrekt zu `TT.MM.JJJJ` formatiert.
- Erweiterte Backup-Tests (`backupRepository.test.ts`, `backupSerializer.test.ts`) für die neue Tabelle `doctorVisits`.
- UI (Listen-/Formular-Screens, Navigation, Export-Button) wie bei den bisherigen Features nicht automatisiert testbar – Verifikation über `tsc --noEmit` und manuellen Test (Anlegen, Bearbeiten, Löschen, PDF-Export, Navigation vom Tagebuch-Tab aus, alle drei Themes).

## Explizit nicht Teil dieses Schritts

- Keine Verknüpfung von Arztbesuchen mit einzelnen Tagebucheinträgen oder Medikamenten (bewusst eigenständige, einfache Erfassung).
- Kein Erinnerungs-/Benachrichtigungssystem für den "Nächsten Termin" (reines Datenfeld, keine Push-Benachrichtigung – wie bei der Schub-Frühwarnung gilt: keine Hintergrundausführung in dieser App).
- Kein Export nur zukünftiger Termine (bewusst komplette Historie, wie abgestimmt).

---

*Hinweis: Diese App ersetzt keine ärztliche Beratung. Diese Spec betrifft ausschließlich eine technische Erfassungs-/Exportfunktion auf Basis selbst eingegebener Daten, keine medizinische Bewertung oder Empfehlung.*
