/**
 * Ein Loeschvorgang, der angefordert, aber noch nicht ausgefuehrt wurde.
 * Solange er hier steht, ist in der Datenbank nichts passiert.
 */
export interface PendingDeletion<TId> {
  id: TId;
  /** Was im Rueckgaengig-Streifen steht, etwa "Eintrag". */
  label: string;
}

export interface DeletionState<TId> {
  pending: PendingDeletion<TId> | null;
}

export interface DeletionOutcome<TId> {
  state: DeletionState<TId>;
  /** Was der Aufrufer jetzt wirklich loeschen muss. null heisst: nichts zu tun. */
  commit: TId | null;
}

export const EMPTY_DELETION_STATE: DeletionState<never> = { pending: null };

/**
 * Ein zweites Loeschen bei laufender Uhr fuehrt das erste sofort aus. Mehrere
 * Uhren gleichzeitig zu verwalten waere ueberfluessig komplex, und der Streifen
 * kann ohnehin nur einen Vorgang zeigen.
 */
export function requestDeletion<TId>(
  state: DeletionState<TId>,
  entry: PendingDeletion<TId>
): DeletionOutcome<TId> {
  // Dieselbe Kennung noch einmal: nur die Uhr neu starten. Wuerde hier
  // ausgefuehrt, waere der Eintrag weg, waehrend der Streifen noch
  // Rueckgaengig anbietet - genau das, was diese Phase verhindern soll.
  if (state.pending !== null && state.pending.id === entry.id) {
    return { state: { pending: entry }, commit: null };
  }

  return {
    state: { pending: entry },
    commit: state.pending === null ? null : state.pending.id,
  };
}

export function undoDeletion<TId>(state: DeletionState<TId>): DeletionOutcome<TId> {
  // Wartet nichts, kommt derselbe Zustand zurueck statt eines neuen leeren -
  // sonst loeste ein Rueckgaengig ins Leere ein ueberfluessiges Neuzeichnen aus.
  if (state.pending === null) {
    return { state, commit: null };
  }
  return { state: { pending: null }, commit: null };
}

export function commitDeletion<TId>(state: DeletionState<TId>): DeletionOutcome<TId> {
  return {
    state: { pending: null },
    commit: state.pending === null ? null : state.pending.id,
  };
}
