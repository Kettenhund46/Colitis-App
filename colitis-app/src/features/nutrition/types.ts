export interface Meal {
  id: number;
  /** Zeitpunkt der Mahlzeit, ISO in UTC. */
  eatenAt: string;
  description: string;
}

export interface MealInput {
  eatenAt: string;
  description: string;
}
