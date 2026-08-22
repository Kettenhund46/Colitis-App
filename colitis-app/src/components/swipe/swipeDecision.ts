/**
 * Breite des Streifens an der Bildschirmkante, in dem die Tab-Wischgeste
 * beginnen muss. Einziger Ort dieses Wertes: SwipeableTabScreen holt ihn
 * ebenfalls hier. Driften die beiden auseinander, gibt es Beruehrungen, die
 * beide Gesten fuer sich beanspruchen.
 */
export const EDGE_WIDTH = 25;

/**
 * Waagerechte Mindeststrecke nach links, ab der eine Bewegung als Loeschwisch
 * gilt. Bewusst hoeher als die 60 Pixel der Tab-Geste: Diese hier ist die
 * zerstoererische von beiden und soll nicht beim Scrollen mit leicht schraeger
 * Fingerbewegung ausloesen.
 */
export const ROW_SWIPE_THRESHOLD = 96;

export interface SwipeAttempt {
  /** Waagerechte Position, an der die Beruehrung begann. */
  startX: number;
  /** Zurueckgelegte Strecke seit Beruehrungsbeginn, negativ ist nach links. */
  dx: number;
  dy: number;
  screenWidth: number;
}

export function startedInEdgeStrip(startX: number, screenWidth: number): boolean {
  return startX <= EDGE_WIDTH || startX >= screenWidth - EDGE_WIDTH;
}

export function isDeleteSwipe({ startX, dx, dy, screenWidth }: SwipeAttempt): boolean {
  if (startedInEdgeStrip(startX, screenWidth)) {
    return false;
  }
  if (dx >= 0) {
    return false;
  }
  if (Math.abs(dx) <= Math.abs(dy)) {
    return false;
  }
  return Math.abs(dx) >= ROW_SWIPE_THRESHOLD;
}

/**
 * Waagerechte Mindeststrecke, ab der die Zeilengeste den Responder ueberhaupt
 * beansprucht. Ohne sie kaeme jeder Tipp, der zwei Pixel nach links rutscht,
 * bei den Knoepfen in der Zeile nicht mehr an.
 */
export const ROW_SWIPE_CLAIM_THRESHOLD = 10;

/** Ob die Zeilengeste diese Bewegung ueberhaupt uebernehmen soll. */
export function shouldClaimRowSwipe({ startX, dx, dy, screenWidth }: SwipeAttempt): boolean {
  if (startedInEdgeStrip(startX, screenWidth)) {
    return false;
  }
  if (dx >= 0) {
    return false;
  }
  if (Math.abs(dx) <= Math.abs(dy)) {
    return false;
  }
  return Math.abs(dx) >= ROW_SWIPE_CLAIM_THRESHOLD;
}
