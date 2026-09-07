import { describe, it, expect, beforeEach, beforeAll, afterAll } from 'vitest';
import { createTestDb } from './db/testDb';
import {
  createMedication,
  updateMedication,
  endMedication,
  pauseMedication,
  resumeMedication,
  listMedications,
  logMedicationTaken,
  listMedicationIntakes,
} from './db/medicationsRepository';
import { listScheduleHistory } from './db/scheduleHistoryRepository';
import { buildDaySummaries } from './adherence';
import type { MedicationInput } from './types';
import type { DaySummary } from './adherence';

/**
 * Die Abfolge aus der Rueckmeldung vom 07.09. an einem Stueck: Wechsel von
 * einer auf zwei Einnahmen pro Tag, Pausieren, Fortsetzen, Beenden.
 *
 * Der Kern der Pruefung ist nicht, dass die einzelnen Schritte funktionieren
 * -- das decken die Tests der Repositories ab. Geprueft wird, dass ein
 * vergangener Tag nach jedem Schritt noch dieselbe Bewertung traegt wie vor
 * dem Schritt. Genau das war bis zum 04.09. nicht der Fall.
 */

const START = '2026-06-01';

function input(overrides: Partial<MedicationInput> = {}): MedicationInput {
  return {
    name: 'Mesalazin',
    dose: '500mg',
    schedule: 'nach Plan',
    startDate: START,
    endDate: null,
    sideEffectsNote: null,
    unitsPerIntake: 1,
    packUnits: null,
    stockUnits: null,
    reminderTimes: ['08:00'],
    ...overrides,
  };
}

/** Lokale Uhrzeit als ISO -- so, wie die App eine Einnahme protokolliert. */
function localIso(year: number, month: number, day: number, hour: number): string {
  return new Date(year, month - 1, day, hour).toISOString();
}

describe('Medikamentenhistorie ueber die volle Abfolge', () => {
  let db: ReturnType<typeof createTestDb>;
  let originalTz: string | undefined;

  beforeAll(() => {
    originalTz = process.env.TZ;
    process.env.TZ = 'Europe/Berlin';
  });

  afterAll(() => {
    process.env.TZ = originalTz;
  });

  beforeEach(() => {
    db = createTestDb();
  });

  async function summariesFor(fromDate: string, toDate: string): Promise<Map<string, DaySummary>> {
    const [medications, intakes, history] = await Promise.all([
      listMedications(db),
      listMedicationIntakes(db, null),
      listScheduleHistory(db),
    ]);
    const summaries = buildDaySummaries(medications, intakes, history, fromDate, toDate);
    return new Map(summaries.map((summary) => [summary.date, summary]));
  }

  it('haelt jeden vergangenen Tag durch die ganze Abfolge hindurch fest', async () => {
    // Ausgangslage: eine Einnahme pro Tag ab dem 01.06.
    const created = await createMedication(db, input());

    // Am 10.06. genau diese eine Einnahme erfasst -- der Tag ist vollstaendig.
    await logMedicationTaken(db, created.id, localIso(2026, 6, 10, 8));

    const vorher = await summariesFor('2026-06-10', '2026-06-10');
    expect(vorher.get('2026-06-10')?.medications[0].expected).toBe(1);
    expect(vorher.get('2026-06-10')?.state).toBe('complete');

    // Schritt 1: ab dem 01.07. zwei Einnahmen pro Tag.
    await updateMedication(db, created.id, input({ reminderTimes: ['08:00', '20:00'] }), '2026-07-01');

    // Der Juni-Tag muss weiterhin gegen eine Einnahme gemessen werden.
    // Vor der Historisierung stand hier "1 von 2" und der Tag war rot.
    const nachDosiswechsel = await summariesFor('2026-06-10', '2026-07-05');
    expect(nachDosiswechsel.get('2026-06-10')?.medications[0].expected).toBe(1);
    expect(nachDosiswechsel.get('2026-06-10')?.state).toBe('complete');
    expect(nachDosiswechsel.get('2026-07-05')?.medications[0].expected).toBe(2);

    // Schritt 2: am 01.08. pausieren.
    await pauseMedication(db, created.id, '2026-08-01');

    const nachPause = await summariesFor('2026-06-10', '2026-08-05');
    expect(nachPause.get('2026-06-10')?.state).toBe('complete');
    expect(nachPause.get('2026-07-05')?.medications[0].expected).toBe(2);
    // Die Pause ist kein Versaeumnis.
    expect(nachPause.get('2026-08-05')?.state).toBe('paused');
    expect(nachPause.get('2026-08-05')?.medications[0].isPaused).toBe(true);

    // Schritt 3: am 10.08. fortsetzen.
    await resumeMedication(db, created.id, '2026-08-10');

    const nachFortsetzen = await summariesFor('2026-06-10', '2026-08-15');
    expect(nachFortsetzen.get('2026-06-10')?.state).toBe('complete');
    expect(nachFortsetzen.get('2026-08-05')?.state).toBe('paused');
    // Fortgesetzt wird mit der Anzahl, die die Erinnerungszeiten heute vorgeben.
    expect(nachFortsetzen.get('2026-08-15')?.medications[0].expected).toBe(2);

    // Schritt 4: am 20.08. beenden.
    await endMedication(db, created.id, '2026-08-20');

    const nachBeenden = await summariesFor('2026-06-10', '2026-08-25');
    // Alles davor steht unveraendert.
    expect(nachBeenden.get('2026-06-10')?.medications[0].expected).toBe(1);
    expect(nachBeenden.get('2026-06-10')?.state).toBe('complete');
    expect(nachBeenden.get('2026-07-05')?.medications[0].expected).toBe(2);
    expect(nachBeenden.get('2026-08-05')?.state).toBe('paused');
    expect(nachBeenden.get('2026-08-15')?.medications[0].expected).toBe(2);
    // Nach dem Enddatum ist nichts mehr faellig.
    expect(nachBeenden.has('2026-08-25')).toBe(false);
  });

  it('laesst die erfasste Einnahme selbst unangetastet', async () => {
    const created = await createMedication(db, input());
    await logMedicationTaken(db, created.id, localIso(2026, 6, 10, 8));

    await updateMedication(db, created.id, input({ reminderTimes: ['08:00', '20:00'] }), '2026-07-01');
    await pauseMedication(db, created.id, '2026-08-01');
    await resumeMedication(db, created.id, '2026-08-10');
    await endMedication(db, created.id, '2026-08-20');

    const intakes = await listMedicationIntakes(db, null);
    expect(intakes).toHaveLength(1);
    expect(intakes[0].takenAt).toBe(localIso(2026, 6, 10, 8));
  });

  it('beendet das Medikament, statt es zu loeschen', async () => {
    // Der Fehler vom 21.07.: "Beenden" rief deleteMedication auf.
    const created = await createMedication(db, input());
    await endMedication(db, created.id, '2026-08-20');

    const medications = await listMedications(db);
    expect(medications).toHaveLength(1);
    expect(medications[0].id).toBe(created.id);
    expect(medications[0].endDate).toBe('2026-08-20');
  });
});
