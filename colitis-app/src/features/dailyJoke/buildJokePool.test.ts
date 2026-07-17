import { describe, it, expect } from 'vitest';
import { buildJokePool } from './buildJokePool';
import { jokes } from './jokes';
import { illnessJokes } from './illnessJokes';

describe('buildJokePool', () => {
  it('returns only the general jokes when illness jokes are excluded', () => {
    expect(buildJokePool(false)).toEqual(jokes);
  });

  it('mixes in the illness jokes when included', () => {
    const pool = buildJokePool(true);
    expect(pool).toHaveLength(jokes.length + illnessJokes.length);
    jokes.forEach((joke) => expect(pool).toContain(joke));
    illnessJokes.forEach((joke) => expect(pool).toContain(joke));
  });
});
