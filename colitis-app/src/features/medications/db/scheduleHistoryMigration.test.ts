import { describe, it, expect } from 'vitest';
import Database from 'better-sqlite3';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Migration 0013 gegen Bestandsdaten.
 *
 * Die uebrigen Tests legen ihre Datenbank leer an und lassen alle Migrationen
 * darueber laufen -- die Nachtragung in 0013 arbeitet dabei auf null
 * Medikamenten und wird nie wirklich ausgefuehrt. Genau das ist aber der Fall,
 * der auf dem Geraet eines Nutzers eintritt, der die App aktualisiert.
 */

const MIGRATIONS_DIR = join(__dirname, '../../../../drizzle');

function migrationFiles(): string[] {
  return readdirSync(MIGRATIONS_DIR)
    .filter((file) => file.endsWith('.sql'))
    .sort();
}

function applyMigration(sqlite: Database.Database, file: string): void {
  const sql = readFileSync(join(MIGRATIONS_DIR, file), 'utf-8');
  for (const statement of sql.split('--> statement-breakpoint')) {
    const trimmed = statement.trim();
    if (trimmed.length > 0) {
      sqlite.exec(trimmed);
    }
  }
}

/** Eine Datenbank auf dem Stand vor der Zeitplan-Historie. */
function databaseBefore0013(): Database.Database {
  const sqlite = new Database(':memory:');
  for (const file of migrationFiles()) {
    if (file.startsWith('0013')) {
      break;
    }
    applyMigration(sqlite, file);
  }
  return sqlite;
}

function apply0013(sqlite: Database.Database): void {
  const file = migrationFiles().find((name) => name.startsWith('0013'));
  if (file === undefined) {
    throw new Error('Migration 0013 nicht gefunden');
  }
  applyMigration(sqlite, file);
}

interface HistoryRow {
  medication_id: number;
  valid_from: string;
  valid_to: string | null;
  doses_per_day: number;
}

function historyOf(sqlite: Database.Database): HistoryRow[] {
  return sqlite
    .prepare('SELECT medication_id, valid_from, valid_to, doses_per_day FROM medication_schedule_history ORDER BY medication_id')
    .all() as HistoryRow[];
}

function insertMedication(
  sqlite: Database.Database,
  name: string,
  startDate: string,
  endDate: string | null
): number {
  const info = sqlite
    .prepare(
      'INSERT INTO medications (name, dose, schedule, start_date, end_date, units_per_intake) VALUES (?, ?, ?, ?, ?, 1)'
    )
    .run(name, '500mg', 'nach Plan', startDate, endDate);
  return Number(info.lastInsertRowid);
}

function insertReminderTimes(sqlite: Database.Database, medicationId: number, times: string[]): void {
  for (const time of times) {
    sqlite
      .prepare('INSERT INTO medication_reminder_times (medication_id, time) VALUES (?, ?)')
      .run(medicationId, time);
  }
}

describe('Migration 0013 gegen vorhandene Daten', () => {
  it('legt je Medikament einen Abschnitt ueber seine ganze Laufzeit an', () => {
    const sqlite = databaseBefore0013();
    const id = insertMedication(sqlite, 'Mesalazin', '2026-06-01', null);
    insertReminderTimes(sqlite, id, ['08:00', '13:00', '19:00']);

    apply0013(sqlite);

    expect(historyOf(sqlite)).toEqual([
      { medication_id: id, valid_from: '2026-06-01', valid_to: null, doses_per_day: 3 },
    ]);
  });

  it('uebernimmt das Enddatum eines beendeten Medikaments', () => {
    const sqlite = databaseBefore0013();
    const id = insertMedication(sqlite, 'Prednisolon', '2026-06-01', '2026-08-31');
    insertReminderTimes(sqlite, id, ['08:00']);

    apply0013(sqlite);

    expect(historyOf(sqlite)[0]).toMatchObject({ valid_to: '2026-08-31', doses_per_day: 1 });
  });

  it('zaehlt eine faellige Einnahme, wenn gar keine Erinnerungszeit hinterlegt war', () => {
    // Wer keine Erinnerung wollte, nimmt das Medikament deswegen nicht
    // seltener. Ohne diesen Fall stuende in der Rueckschau ueberall "0 von 0".
    const sqlite = databaseBefore0013();
    const id = insertMedication(sqlite, 'Tremfya', '2026-05-01', null);

    apply0013(sqlite);

    expect(historyOf(sqlite)[0]).toMatchObject({ medication_id: id, doses_per_day: 1 });
  });

  it('haelt mehrere Medikamente auseinander', () => {
    const sqlite = databaseBefore0013();
    const ersteId = insertMedication(sqlite, 'Mesalazin', '2026-06-01', null);
    insertReminderTimes(sqlite, ersteId, ['08:00', '19:00']);
    const zweiteId = insertMedication(sqlite, 'Azathioprin', '2026-07-15', '2026-08-01');
    insertReminderTimes(sqlite, zweiteId, ['20:00']);

    apply0013(sqlite);

    expect(historyOf(sqlite)).toEqual([
      { medication_id: ersteId, valid_from: '2026-06-01', valid_to: null, doses_per_day: 2 },
      { medication_id: zweiteId, valid_from: '2026-07-15', valid_to: '2026-08-01', doses_per_day: 1 },
    ]);
  });

  it('legt ohne vorhandene Medikamente nichts an', () => {
    const sqlite = databaseBefore0013();

    apply0013(sqlite);

    expect(historyOf(sqlite)).toEqual([]);
  });
});
