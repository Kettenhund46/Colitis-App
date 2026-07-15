export const ROLLING_WINDOW_DAYS = 183;
export const PUBMED_LOOKBACK_OVERLAP_DAYS = 10;

function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function computeRollingWindowCutoff(now: Date): string {
  const cutoff = new Date(now);
  cutoff.setUTCDate(cutoff.getUTCDate() - ROLLING_WINDOW_DAYS);
  return toIsoDate(cutoff);
}

export function isWithinRollingWindow(publishedDate: string, now: Date): boolean {
  return publishedDate >= computeRollingWindowCutoff(now);
}

export function computePubmedSearchSinceDate(previousGeneratedAt: string | null, now: Date): string {
  if (previousGeneratedAt === null) {
    return computeRollingWindowCutoff(now);
  }
  const lastRun = new Date(previousGeneratedAt);
  lastRun.setUTCDate(lastRun.getUTCDate() - PUBMED_LOOKBACK_OVERLAP_DAYS);
  return toIsoDate(lastRun);
}
