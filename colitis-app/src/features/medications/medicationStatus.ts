export function isMedicationActive(endDate: string | null, today: Date): boolean {
  if (endDate === null) {
    return true;
  }
  return endDate >= formatLocalDate(today);
}

function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
