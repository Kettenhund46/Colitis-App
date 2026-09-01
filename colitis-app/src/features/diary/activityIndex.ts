import { groupEntriesByDay, sumDayTotals } from './calendarLogic';
import { eachDayInclusive } from '../../lib/localDate';
import { formatDecimalComma } from '../../lib/formatNumber';
import type { DayTotals } from './calendarLogic';
import type { DiaryEntryWithTriggers } from './types';

/**
 * Der 6-Punkte-Mayo, auch PRO-2 genannt: die beiden vom Patienten selbst
 * berichteten Teilwerte des Mayo-Scores, Stuhlfrequenz und Blutbeimengung,
 * je 0 bis 3. Die endoskopischen und aerztlichen Teile bleiben aussen vor --
 * die kann eine App nicht erheben.
 */
export const MAX_ACTIVITY_INDEX = 6;
export const MAX_SUBSCORE = 3;

export const ACTIVITY_INDEX_NAME = 'Krankheitsaktivität (6-Punkte-Mayo)';

/**
 * Steht unter jeder Ausgabe der Zahl. Die App rechnet und zeigt an; sie
 * beurteilt nicht. Eine Ableitung wie "Sie sind in Remission" waere eine
 * aerztliche Aussage.
 */
export const ACTIVITY_INDEX_ORIGIN_NOTE =
  'Selbsteinschätzung nach dem Muster des 6-Punkte-Mayo-Scores (Stuhlfrequenz und Blutbeimengung). Ersetzt keine ärztliche Beurteilung.';

export const NO_BASELINE_TEXT =
  'Für die Krankheitsaktivität fehlt deine übliche Zahl an Stuhlgängen pro Tag. Sie steht in den Einstellungen unter „Tagebuch“ — der Mayo-Score zählt die Frequenz relativ dazu.';

export interface ActivityIndex {
  /** 0 bis 3, aus der Stuhlfrequenz im Vergleich zum eigenen Normalwert. */
  stoolSubscore: number;
  /** 0 bis 3, die schwerste Blutbeimengung des Tages. */
  bloodSubscore: number;
  /** Summe beider, 0 bis 6. */
  total: number;
}

export interface DayActivityPoint {
  /** YYYY-MM-DD, lokal. */
  date: string;
  index: ActivityIndex;
}

/**
 * Der Frequenz-Teilwert zaehlt nicht absolut, sondern den Ueberschuss zur
 * eigenen ueblichen Zahl: 0 keiner, 1 ein bis zwei mehr, 2 drei bis vier
 * mehr, 3 fuenf oder mehr. Weniger als ueblich bleibt 0 -- der Score kennt
 * keine negativen Werte.
 */
export function stoolFrequencySubscore(totalStools: number, normalStools: number): number {
  const excess = totalStools - normalStools;
  if (excess <= 0) {
    return 0;
  }
  if (excess <= 2) {
    return 1;
  }
  if (excess <= 4) {
    return 2;
  }
  return MAX_SUBSCORE;
}

export function computeDayActivityIndex(totals: DayTotals, normalStools: number): ActivityIndex {
  const stoolSubscore = stoolFrequencySubscore(totals.totalStoolFrequency, normalStools);
  const bloodSubscore = totals.worstBloodLevel;

  return { stoolSubscore, bloodSubscore, total: stoolSubscore + bloodSubscore };
}

/**
 * Ein Punkt je erfasstem Tag, in zeitlicher Folge. Nicht erfasste Tage
 * bekommen keinen Punkt -- eine 0 waere die Behauptung, es sei an dem Tag
 * gut gewesen.
 */
export function buildDailyActivityIndex(
  entries: DiaryEntryWithTriggers[],
  fromDate: string,
  toDate: string,
  normalStools: number
): DayActivityPoint[] {
  const byDay = groupEntriesByDay(entries);

  return eachDayInclusive(fromDate, toDate)
    .map((date) => {
      const dayEntries = byDay.get(date);
      if (dayEntries === undefined) {
        return null;
      }
      return { date, index: computeDayActivityIndex(sumDayTotals(dayEntries), normalStools) };
    })
    .filter((point): point is DayActivityPoint => point !== null);
}

/** Auf eine Nachkommastelle, oder null ohne einen einzigen erfassten Tag. */
export function averageActivityIndex(points: DayActivityPoint[]): number | null {
  if (points.length === 0) {
    return null;
  }
  const sum = points.reduce((total, point) => total + point.index.total, 0);
  return Math.round((sum / points.length) * 10) / 10;
}

/** Der juengste erfasste Tag, oder null. */
export function latestActivityPoint(points: DayActivityPoint[]): DayActivityPoint | null {
  return points.length === 0 ? null : points[points.length - 1];
}

export function formatActivityIndexValue(index: ActivityIndex): string {
  return `${index.total} von ${MAX_ACTIVITY_INDEX}`;
}

export function formatActivityIndexBreakdown(index: ActivityIndex): string {
  return `Stuhlfrequenz ${index.stoolSubscore} · Blut ${index.bloodSubscore}`;
}

/** Deutsche Schreibweise mit Komma, wie in der Zusammenfassung. */
export function formatActivityAverage(average: number): string {
  return formatDecimalComma(average);
}

export function formatNormalStoolsLabel(normalStools: number): string {
  return normalStools === 1
    ? 'üblich: 1 Stuhlgang pro Tag'
    : `üblich: ${normalStools} Stuhlgänge pro Tag`;
}
