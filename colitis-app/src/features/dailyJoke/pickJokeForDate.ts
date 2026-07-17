export function pickJokeForDate(date: Date, jokes: readonly string[]): string {
  if (jokes.length === 0) {
    throw new Error('Kein Wortwitz verfügbar.');
  }
  const dateKey = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
  let hash = 0;
  for (let i = 0; i < dateKey.length; i += 1) {
    hash = (hash * 31 + dateKey.charCodeAt(i)) >>> 0;
  }
  return jokes[hash % jokes.length];
}
