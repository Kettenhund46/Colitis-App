import { formatLocalDateKey as formatLocalDate } from '../../lib/localDate';

export function isMedicationActive(endDate: string | null, today: Date): boolean {
  if (endDate === null) {
    return true;
  }
  return endDate >= formatLocalDate(today);
}

export { formatLocalDate };
