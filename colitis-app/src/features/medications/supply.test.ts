import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  isSupplyTracked,
  unitsPerDay,
  daysRemaining,
  runsOutOn,
  isSupplyLow,
  stockAfterIntake,
  stockAfterIntakeRemoved,
  stockAfterRefill,
  buildSupplyReminderTrigger,
  buildSupplyReminderBody,
  formatSupplyLabel,
  formatRefillLabel,
  formatUnitCount,
  DEFAULT_PRESCRIPTION_LEAD_DAYS,
} from './supply';
import type { Medication } from './types';

function medication(overrides: Partial<Medication> = {}): Medication {
  return {
    id: 1,
    name: 'Salofalk',
    dose: '500 mg',
    schedule: '3x täglich',
    startDate: '2026-08-01',
    endDate: null,
    sideEffectsNote: null,
    unitsPerIntake: 1,
    packUnits: null,
    stockUnits: null,
    supplyNotificationId: null,
    reminderTimes: [],
    ...overrides,
  };
}

/** Drei Erinnerungszeiten heissen drei faellige Einnahmen am Tag. */
function threeTimesDaily(): Medication['reminderTimes'] {
  return [
    { id: 1, time: '08:00', notificationId: null },
    { id: 2, time: '13:00', notificationId: null },
    { id: 3, time: '19:00', notificationId: null },
  ];
}

describe('isSupplyTracked', () => {
  it('is false without a stock, even with a pack size', () => {
    expect(isSupplyTracked(medication({ packUnits: 100 }))).toBe(false);
  });

  it('is true at a stock of zero -- empty is not the same as untracked', () => {
    expect(isSupplyTracked(medication({ stockUnits: 0 }))).toBe(true);
  });
});

describe('unitsPerDay', () => {
  it('is one a day without reminder times', () => {
    expect(unitsPerDay(medication())).toBe(1);
  });

  it('multiplies the doses of the day by the units per dose', () => {
    expect(unitsPerDay(medication({ reminderTimes: threeTimesDaily(), unitsPerIntake: 2 }))).toBe(6);
  });

  it('treats a units-per-intake below one as one', () => {
    expect(unitsPerDay(medication({ unitsPerIntake: 0 }))).toBe(1);
  });
});

describe('daysRemaining', () => {
  it('is null when no stock is kept', () => {
    expect(daysRemaining(medication())).toBeNull();
  });

  it('counts only whole days', () => {
    // Sieben Einheiten bei drei am Tag: zwei volle Tage, der Rest reicht nicht.
    const value = daysRemaining(medication({ stockUnits: 7, reminderTimes: threeTimesDaily() }));
    expect(value).toBe(2);
  });

  it('is zero at an empty stock', () => {
    expect(daysRemaining(medication({ stockUnits: 0 }))).toBe(0);
  });

  it('never goes negative', () => {
    expect(daysRemaining(medication({ stockUnits: -5 }))).toBe(0);
  });
});

describe('runsOutOn', () => {
  let originalTz: string | undefined;

  beforeAll(() => {
    originalTz = process.env.TZ;
    process.env.TZ = 'Europe/Berlin';
  });

  afterAll(() => {
    if (originalTz === undefined) {
      delete process.env.TZ;
    } else {
      process.env.TZ = originalTz;
    }
  });

  it('is null when no stock is kept', () => {
    expect(runsOutOn(medication(), '2026-09-02')).toBeNull();
  });

  it('names the first day the stock no longer covers', () => {
    expect(runsOutOn(medication({ stockUnits: 5 }), '2026-09-02')).toBe('2026-09-07');
  });

  it('is today when the stock is already empty', () => {
    expect(runsOutOn(medication({ stockUnits: 0 }), '2026-09-02')).toBe('2026-09-02');
  });

  it('crosses the month boundary', () => {
    expect(runsOutOn(medication({ stockUnits: 3 }), '2026-08-30')).toBe('2026-09-02');
  });
});

describe('isSupplyLow', () => {
  it('is false without a stock', () => {
    expect(isSupplyLow(medication(), DEFAULT_PRESCRIPTION_LEAD_DAYS)).toBe(false);
  });

  it('is true exactly at the lead time', () => {
    expect(isSupplyLow(medication({ stockUnits: 7 }), 7)).toBe(true);
  });

  it('is false one day above the lead time', () => {
    expect(isSupplyLow(medication({ stockUnits: 8 }), 7)).toBe(false);
  });
});

describe('stock changes', () => {
  it('deducts the units of one intake', () => {
    expect(stockAfterIntake(medication({ stockUnits: 10, unitsPerIntake: 2 }))).toBe(8);
  });

  it('stops at zero instead of going negative', () => {
    expect(stockAfterIntake(medication({ stockUnits: 1, unitsPerIntake: 2 }))).toBe(0);
  });

  it('puts the units back when an intake is removed', () => {
    expect(stockAfterIntakeRemoved(medication({ stockUnits: 8, unitsPerIntake: 2 }))).toBe(10);
  });

  it('adds a whole pack on refill', () => {
    expect(stockAfterRefill(medication({ stockUnits: 4, packUnits: 100 }))).toBe(104);
  });

  it('refills nothing without a pack size', () => {
    expect(stockAfterRefill(medication({ stockUnits: 4 }))).toBeNull();
  });

  it('leaves an untracked medication alone in every direction', () => {
    const untracked = medication({ packUnits: 100 });
    expect(stockAfterIntake(untracked)).toBeNull();
    expect(stockAfterIntakeRemoved(untracked)).toBeNull();
    expect(stockAfterRefill(untracked)).toBeNull();
  });
});

describe('buildSupplyReminderTrigger', () => {
  let originalTz: string | undefined;

  beforeAll(() => {
    originalTz = process.env.TZ;
    process.env.TZ = 'Europe/Berlin';
  });

  afterAll(() => {
    if (originalTz === undefined) {
      delete process.env.TZ;
    } else {
      process.env.TZ = originalTz;
    }
  });

  const NOW = new Date(2026, 8, 2, 12, 0, 0, 0);

  it('is null when no stock is kept', () => {
    expect(buildSupplyReminderTrigger(medication(), '2026-09-02', 7, NOW)).toBeNull();
  });

  it('fires the lead time before the stock runs out', () => {
    // 20 Einheiten, eine am Tag: leer am 22.09., sieben Tage davor ist der 15.09.
    const trigger = buildSupplyReminderTrigger(medication({ stockUnits: 20 }), '2026-09-02', 7, NOW);
    expect(trigger?.date).toEqual(new Date(2026, 8, 15, 10, 0, 0, 0));
  });

  it('schedules nothing when the supply is already low', () => {
    expect(buildSupplyReminderTrigger(medication({ stockUnits: 3 }), '2026-09-02', 7, NOW)).toBeNull();
  });

  it('schedules nothing for an empty stock', () => {
    expect(buildSupplyReminderTrigger(medication({ stockUnits: 0 }), '2026-09-02', 7, NOW)).toBeNull();
  });
});

describe('labels', () => {
  it('uses the singular for one unit', () => {
    expect(formatUnitCount(1)).toBe('1 Einheit');
  });

  it('names stock and reach together', () => {
    expect(formatSupplyLabel(medication({ stockUnits: 20 }))).toBe('Vorrat: 20 Einheiten · reicht 20 Tage');
  });

  it('says plainly when the stock no longer covers a day', () => {
    expect(formatSupplyLabel(medication({ stockUnits: 2, reminderTimes: threeTimesDaily() }))).toBe(
      'Vorrat: 2 Einheiten · reicht nicht mehr für einen ganzen Tag'
    );
  });

  it('has no label without a stock', () => {
    expect(formatSupplyLabel(medication())).toBeNull();
  });

  it('names the pack size on the refill button', () => {
    expect(formatRefillLabel(medication({ packUnits: 100 }))).toBe('+ Packung (100)');
  });

  it('has no refill button without a pack size', () => {
    expect(formatRefillLabel(medication())).toBeNull();
  });

  it('leaves the remaining days out of the notification', () => {
    // Sie wird Tage im Voraus geplant -- eine damals gerechnete Zahl waere
    // beim Eintreffen falsch.
    const body = buildSupplyReminderBody(medication({ stockUnits: 20 }));
    expect(body).toBe('Salofalk geht zur Neige. Zeit für ein neues Rezept.');
    expect(body).not.toMatch(/\d/);
  });
});
