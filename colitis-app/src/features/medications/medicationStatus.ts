export function isMedicationActive(endDate: string | null, today: Date): boolean {
  if (endDate === null) {
    return true;
  }
  const todayDateOnly = today.toISOString().slice(0, 10);
  return endDate >= todayDateOnly;
}
