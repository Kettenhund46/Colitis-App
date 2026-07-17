import { jokes } from './jokes';
import { illnessJokes } from './illnessJokes';

export function buildJokePool(includeIllnessJokes: boolean): string[] {
  return includeIllnessJokes ? [...jokes, ...illnessJokes] : [...jokes];
}
