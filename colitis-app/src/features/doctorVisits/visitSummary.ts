import { addDays, eachDayInclusive, formatLocalDateKey, parseLocalDate } from '../../lib/localDate';
import { formatGermanDate } from './doctorVisitPassBuilder';
import type { DoctorVisit } from './types';
import { groupEntriesByDay, rateDayTotals, sumDayTotals } from '../diary/calendarLogic';
import type { DiaryEntryWithTriggers } from '../diary/types';

/** Zeitraum, wenn noch kein Arztbesuch erfasst ist. */
export const DEFAULT_PERIOD_DAYS = 90;

/**
 * Unterhalb dieser Zahl erfasster Tage entfallen Kennzahlen, Phasen und
 * Ausloeser. Ein Mittelwert aus vier Eintraegen ueber drei Monate ist keine
 * Aussage, sondern eine irrefuehrende Zahl.
 */
export const MIN_DAYS_FOR_FIGURES = 7;

export interface SummaryPeriod {
  /** YYYY-MM-DD, lokal. */
  fromDate: string;
  /** YYYY-MM-DD, lokal -- heute. */
  toDate: string;
  /** Kalendertage einschliesslich beider Enden. */
  dayCount: number;
  /**
   * Woran der Zeitraum anschliesst, fertig formuliert. null bei der
   * 90-Tage-Regel; dann nennt formatPeriodLabel "letzte 90 Tage".
   */
  sinceVisitLabel: string | null;
}

function buildSinceVisitLabel(visit: DoctorVisit): string {
  if (visit.doctorName !== null && visit.doctorName.trim().length > 0) {
    return `seit dem Besuch bei ${visit.doctorName.trim()}`;
  }
  return `seit dem Besuch am ${formatGermanDate(visit.visitDate)}`;
}

export function determinePeriod(visits: DoctorVisit[], today: string): SummaryPeriod {
  // Ein vorab eingetragener Termin in der Zukunft taugt nicht als Beginn eines
  // Rueckblicks. Die Reihenfolge der Liste wird bewusst nicht vorausgesetzt.
  const pastVisits = visits.filter((visit) => visit.visitDate <= today);

  if (pastVisits.length === 0) {
    const fromDate = formatLocalDateKey(
      addDays(parseLocalDate(today), -(DEFAULT_PERIOD_DAYS - 1))
    );
    return { fromDate, toDate: today, dayCount: DEFAULT_PERIOD_DAYS, sinceVisitLabel: null };
  }

  const latestVisit = pastVisits.reduce((newest, candidate) =>
    candidate.visitDate > newest.visitDate ? candidate : newest
  );

  return {
    fromDate: latestVisit.visitDate,
    toDate: today,
    dayCount: eachDayInclusive(latestVisit.visitDate, today).length,
    sinceVisitLabel: buildSinceVisitLabel(latestVisit),
  };
}

export function formatPeriodLabel(period: SummaryPeriod): string {
  const range = `${formatGermanDate(period.fromDate)} – ${formatGermanDate(period.toDate)}`;
  const since =
    period.sinceVisitLabel === null
      ? `letzte ${period.dayCount} Tage`
      : `${period.dayCount} Tage ${period.sinceVisitLabel}`;
  return `${range} · ${since}`;
}

/** Mindestzahl betroffener Tage, damit eine Strecke genannt wird. */
export const MIN_PHASE_DAYS = 3;

/** Wie viele Strecken hoechstens genannt werden. */
export const MAX_PHASES = 2;

export interface SummaryFigures {
  stoolsPerDay: number;
  daysWithBlood: number;
  averagePainLevel: number;
  goodDays: number;
  mediumDays: number;
  badDays: number;
}

export interface NotablePhase {
  /** Erster und letzter betroffener Tag -- nie ein nicht erfasster. */
  fromDate: string;
  toDate: string;
  /** Kalendertage von fromDate bis toDate, beide eingeschlossen. */
  spanDays: number;
  /** Davon Tage mit Bewertung medium oder bad. Der Rest wurde nicht erfasst. */
  affectedDays: number;
  daysWithBlood: number;
}

function roundToOne(value: number): number {
  return Math.round(value * 10) / 10;
}

export function entriesInPeriod(
  entries: DiaryEntryWithTriggers[],
  period: SummaryPeriod
): DiaryEntryWithTriggers[] {
  return entries.filter((entry) => {
    const day = formatLocalDateKey(new Date(entry.occurredAt));
    return day >= period.fromDate && day <= period.toDate;
  });
}

/** Die Eintraege des Zeitraums, nach lokalem Kalendertag gebuendelt. */
export function daysWithEntriesInPeriod(
  entries: DiaryEntryWithTriggers[],
  period: SummaryPeriod
): Map<string, DiaryEntryWithTriggers[]> {
  return groupEntriesByDay(entriesInPeriod(entries, period));
}

export function countDaysWithEntries(
  entries: DiaryEntryWithTriggers[],
  period: SummaryPeriod
): number {
  return daysWithEntriesInPeriod(entries, period).size;
}

export function computeFigures(
  entries: DiaryEntryWithTriggers[],
  period: SummaryPeriod
): SummaryFigures | null {
  const byDay = daysWithEntriesInPeriod(entries, period);
  if (byDay.size < MIN_DAYS_FOR_FIGURES) {
    return null;
  }

  let totalStools = 0;
  let totalWorstPain = 0;
  let daysWithBlood = 0;
  let goodDays = 0;
  let mediumDays = 0;
  let badDays = 0;

  for (const dayEntries of byDay.values()) {
    const totals = sumDayTotals(dayEntries);
    totalStools += totals.totalStoolFrequency;
    totalWorstPain += totals.worstPainLevel;
    if (totals.hasBlood) {
      daysWithBlood += 1;
    }
    const rating = rateDayTotals(totals);
    if (rating === 'good') {
      goodDays += 1;
    } else if (rating === 'medium') {
      mediumDays += 1;
    } else {
      badDays += 1;
    }
  }

  // Geteilt wird durch die Tage MIT Eintrag, nicht durch die Kalendertage.
  // Sonst drueckt jede Erfassungsluecke den Schnitt und taeuscht Besserung vor.
  return {
    stoolsPerDay: roundToOne(totalStools / byDay.size),
    daysWithBlood,
    averagePainLevel: roundToOne(totalWorstPain / byDay.size),
    goodDays,
    mediumDays,
    badDays,
  };
}

export function findNotablePhases(
  entries: DiaryEntryWithTriggers[],
  period: SummaryPeriod
): NotablePhase[] {
  const byDay = daysWithEntriesInPeriod(entries, period);
  const found: NotablePhase[] = [];

  let startDate: string | null = null;
  let lastAffectedDate: string | null = null;
  let affectedDays = 0;
  let daysWithBlood = 0;

  function closeRun() {
    if (startDate !== null && lastAffectedDate !== null && affectedDays >= MIN_PHASE_DAYS) {
      found.push({
        fromDate: startDate,
        toDate: lastAffectedDate,
        spanDays: eachDayInclusive(startDate, lastAffectedDate).length,
        affectedDays,
        daysWithBlood,
      });
    }
    startDate = null;
    lastAffectedDate = null;
    affectedDays = 0;
    daysWithBlood = 0;
  }

  for (const date of eachDayInclusive(period.fromDate, period.toDate)) {
    const dayEntries = byDay.get(date);
    if (dayEntries === undefined) {
      // Ein nicht erfasster Tag unterbricht die Strecke nicht. Er verlaengert
      // sie auch nicht von sich aus -- die Spannweite ergibt sich am Ende aus
      // erstem und letztem betroffenen Tag.
      continue;
    }

    const totals = sumDayTotals(dayEntries);
    if (rateDayTotals(totals) === 'good') {
      closeRun();
      continue;
    }

    if (startDate === null) {
      startDate = date;
    }
    lastAffectedDate = date;
    affectedDays += 1;
    if (totals.hasBlood) {
      daysWithBlood += 1;
    }
  }
  closeRun();

  // Ausgewaehlt wird nach betroffenen Tagen, ausgegeben in zeitlicher Folge.
  const chosen = [...found]
    .sort((a, b) => b.affectedDays - a.affectedDays || b.fromDate.localeCompare(a.fromDate))
    .slice(0, MAX_PHASES);

  return chosen.sort((a, b) => a.fromDate.localeCompare(b.fromDate));
}

export function formatRatingLabel(figures: SummaryFigures): string {
  return `${figures.goodDays} gut · ${figures.mediumDays} mittel · ${figures.badDays} schub-verdächtig`;
}

export function formatPhaseLabel(phase: NotablePhase): string {
  const range = `${formatGermanDate(phase.fromDate)} – ${formatGermanDate(phase.toDate)}`;
  const bloodDayWord = phase.daysWithBlood === 1 ? 'Tag' : 'Tagen';
  const blood =
    phase.daysWithBlood > 0 ? `, an ${phase.daysWithBlood} ${bloodDayWord} Blut vermerkt` : '';
  return `${range}: an ${phase.affectedDays} von ${phase.spanDays} Tagen mittel oder schub-verdächtig${blood}.`;
}

export function formatSparseDataLabel(daysWithEntries: number, dayCount: number): string {
  return `An ${daysWithEntries} von ${dayCount} Tagen wurde etwas erfasst — zu wenig für eine Auswertung des Zeitraums.`;
}
