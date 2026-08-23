import { tokens } from '../../styles/tokens';

/** Kantenlaenge des "+"-Knopfes, wie ihn Tagebuch, Medikamente und Arztbesuche setzen. */
export const FAB_SIZE = 56;

/**
 * Wie weit ein Element ueber dem unteren Bildschirmrand bleiben muss, damit der
 * "+"-Knopf es nicht verdeckt. Der Knopf sitzt absolut bei
 * bottom: tokens.spacing.lg und ist FAB_SIZE hoch; darueber noch ein kleiner
 * Abstand. Aus den Werten abgeleitet und nicht ausgeschrieben, damit eine
 * spaetere Aenderung am Knopf hier nicht still danebenlaeuft.
 *
 * Zwei Stellen brauchen das: der Rueckgaengig-Streifen, der sonst genau unter
 * dem Knopf liegt, und das untere Ende scrollender Listen, deren letzte Karte
 * sonst dahinter verschwindet.
 */
export const FAB_CLEARANCE = tokens.spacing.lg + FAB_SIZE + tokens.spacing.sm;
