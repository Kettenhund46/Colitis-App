export const TAB_ORDER = ['tagebuch', 'wissen', 'medikamente', 'toiletten', 'einstellungen'] as const;

export type TabName = (typeof TAB_ORDER)[number];

export type SwipeDirection = 'previous' | 'next';

export type SwipeEdge = 'left' | 'right';

/**
 * Vom linken Rand darf nur zum vorherigen, vom rechten nur zum naechsten Tab
 * gewischt werden. Einzige Quelle dieser Zuordnung, damit Kaper- und
 * Loslass-Prüfung in SwipeableTabScreen.tsx nicht auseinanderlaufen können.
 */
export function directionForEdge(edge: SwipeEdge): SwipeDirection {
  return edge === 'left' ? 'previous' : 'next';
}

/**
 * Liefert den Nachbar-Tab in der angegebenen Richtung.
 * Gibt null zurück, wenn kein Nachbar existiert (Anfang/Ende der Reihe)
 * oder der übergebene Name kein bekannter Tab ist.
 */
export function getNeighbourTab(current: string, direction: SwipeDirection): TabName | null {
  const currentIndex = (TAB_ORDER as readonly string[]).indexOf(current);
  if (currentIndex === -1) {
    return null;
  }

  const targetIndex = direction === 'next' ? currentIndex + 1 : currentIndex - 1;
  if (targetIndex < 0 || targetIndex >= TAB_ORDER.length) {
    return null;
  }

  return TAB_ORDER[targetIndex];
}

/**
 * Die Tab-Bezeichner sind zugleich die Navigationspfade.
 * Der genaue Template-Literal-Rückgabetyp ist nötig, weil das Projekt
 * `typedRoutes` aktiviert hat und `router.navigate()` keinen beliebigen
 * string annimmt.
 */
export function tabPath(tab: TabName): `/${TabName}` {
  return `/${tab}`;
}
