# Colitis2Go – Design: Nebenwirkungs-Notizen bei Medikamenten

*Status: Vom Nutzer (Adrian) genehmigt am 2026-07-22*
*Grundlage: bestehendes Medikamente-Feature (`src/features/medications/`), achtes Element der Offline-Feature-Roadmap*

## Kontext & Ziel

Medikamente lassen sich aktuell mit Name, Dosis, Einnahmeschema, Start-/Enddatum und Erinnerungszeiten anlegen, aber ohne die Möglichkeit, Nebenwirkungen zu notieren. Ziel dieses Schritts: ein optionales, dauerhaftes Freitextfeld pro Medikament für Nebenwirkungen (z. B. "Verursacht gelegentlich Übelkeit"), sichtbar im Bearbeiten-Formular und in der Medikamenten-Liste.

Es gibt bereits eine `medication_log`-Tabelle (Zeitstempel pro Einnahme), aber keine Verlaufsansicht dafür. Nach Abwägung mit dem Nutzer wird die Notiz bewusst **pro Medikament** (nicht pro einzelner Einnahme) gespeichert – das erfordert keine neue Verlaufsansicht und ist konsistent mit dem bereits etablierten Notiz-Muster bei sicheren Orten und Vorsorge-Terminen.

## 1. Datenmodell

Neue nullable Spalte auf der bestehenden `medications`-Tabelle in `src/db/schema.ts`:

```typescript
export const medications = sqliteTable('medications', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  dose: text('dose').notNull(),
  schedule: text('schedule').notNull(),
  startDate: text('start_date').notNull(),
  endDate: text('end_date'),
  sideEffectsNote: text('side_effects_note'),
});
```

Migration wird mit `npx drizzle-kit generate` erzeugt (rein additiv: `ALTER TABLE medications ADD COLUMN side_effects_note text;`, bestehende Zeilen bekommen automatisch `NULL`, kein Datenverlust für Bestandsnutzer).

`Medication` und `MedicationInput` (`src/features/medications/types.ts`) bekommen jeweils `sideEffectsNote: string | null` (Pflichtfeld im TypeScript-Typ, `null` bei fehlendem Wert – gleiche Konvention wie `note` bei `SavedPlaceInput`/`NewScreeningReminderInput`/`NewDiaryEntryInput`).

`src/features/medications/db/medicationsRepository.ts`: `createMedication`, `updateMedication`, `listMedications` und `getMedicationById` lesen/schreiben das neue Feld zusätzlich zu den bestehenden Spalten.

**Bestehende Tests, die angepasst werden müssen** (da `MedicationInput`/`Medication` das Feld künftig zwingend erwarten):
- `src/features/medications/db/medicationsRepository.test.ts`: alle 12 bestehenden `createMedication`/`updateMedication`-Aufrufe bekommen `sideEffectsNote: null,`.
- `src/features/medications/formLogic.test.ts`: der eine bestehende `toEqual(...)`-Erwartungswert in `buildMedicationInput`-Tests bekommt `sideEffectsNote: null,`.
- `src/features/backup/db/backupRepository.test.ts`: die zwei bestehenden `medications: [{...}]`-Objektliterale (in den Tests `'preserves foreign key relationships...'` und `'does not violate foreign key constraints...'`) bekommen `sideEffectsNote: null,`.

## 2. Formular

`src/features/medications/formLogic.ts`: `MedicationFormState` bekommt `sideEffectsNote: string` (leerer String als Ausgangswert in `INITIAL_MEDICATION_FORM_STATE`). `buildMedicationInput` trimmt den Wert und wandelt einen leeren String in `null` um (gleiche Logik wie bei `endDate`).

`src/features/medications/components/MedicationForm.tsx`: neues Feld "Nebenwirkungen (optional)" (mehrzeiliges Freitextfeld, gleiche Optik wie das bestehende Notiz-Feld im Tagebuch-Formular), platziert am Ende des Formulars nach den Erinnerungszeiten, vor dem Speichern-Button.

`app/(tabs)/medikamente/[id].tsx`: `initialState` beim Bearbeiten bekommt zusätzlich `sideEffectsNote: medication.sideEffectsNote ?? ''`.

## 3. Anzeige

`src/features/medications/components/MedicationList.tsx`: Ist `sideEffectsNote` vorhanden, erscheint in der Medikamenten-Karte eine zusätzliche Zeile ("Nebenwirkungen: …"), platziert nach der Erinnerungszeiten-Zeile und vor dem "Beendet am …"-Hinweis (bzw. vor der Aktionsleiste, falls das Medikament noch aktiv ist).

## 4. Backup

Keine zusätzliche Anbindung nötig: `medications` ist bereits eine vollständig erfasste Tabelle im bestehenden Backup/Restore-System (`src/features/backup/db/backupRepository.ts` liest/schreibt die komplette Zeile via Drizzles `$inferSelect`/`$inferInsert`). Die neue Spalte fließt automatisch mit durch den bestehenden Export/Import, sobald das Schema aktualisiert ist – nur die bestehenden Test-Objektliterale müssen ergänzt werden (siehe Abschnitt 1).

## 5. Fehlerbehandlung

- Kein Wert eingegeben → `sideEffectsNote` bleibt `null`, keine Anzeige in der Liste (kein Sonderfall nötig).
- Bestehende Medikamente aus der Zeit vor diesem Schritt → `sideEffectsNote` ist `null` nach der Migration, Formular zeigt das Feld leer beim Bearbeiten.

## 6. Testing-Ansatz

- Erweiterte Tests in `medicationsRepository.test.ts`: Nebenwirkungs-Notiz wird beim Anlegen gespeichert und beim Lesen zurückgegeben, Notiz wird beim Bearbeiten aktualisiert, `null` bleibt `null`, wenn nichts eingegeben wurde.
- Erweiterte Tests in `formLogic.test.ts`: `buildMedicationInput` trimmt die Notiz und wandelt einen leeren String in `null` um (analog zu `endDate`).
- Bestehende Tests wie in Abschnitt 1 beschrieben mit `sideEffectsNote: null,` ergänzt, damit sie weiterhin kompilieren.
- UI-Komponenten (`MedicationForm.tsx`, `MedicationList.tsx`) wie bei den bisherigen Features nicht automatisiert testbar – Verifikation über `tsc --noEmit` und manuellen Test (Notiz anlegen, bearbeiten, leer lassen, in der Liste sichtbar, alle drei Themes).

## Explizit nicht Teil dieses Schritts

- Keine Notiz pro einzelner Einnahme (`medication_log` bleibt unverändert) – bewusst abgelehnt, da das eine neue Verlaufsansicht erfordern würde, die aktuell nicht existiert.
- Keine strukturierte Erfassung einzelner Nebenwirkungen (z. B. Checkliste) – nur ein einzelnes Freitextfeld, wie abgestimmt.
- Keine Verknüpfung mit dem Tagebuch-Trigger "Medikament" – bleibt ein eigenständiges Feld im Medikamente-Bereich.

---

*Hinweis: Diese App ersetzt keine ärztliche Beratung. Diese Spec betrifft ausschließlich eine technische Erfassungs-/Anzeigefunktion, keine medizinische Bewertung von Nebenwirkungen.*
