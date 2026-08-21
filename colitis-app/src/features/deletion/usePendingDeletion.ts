import { useCallback, useEffect, useRef, useState } from 'react';
import {
  EMPTY_DELETION_STATE,
  requestDeletion,
  undoDeletion,
  commitDeletion,
} from './pendingDeletion';
import { deleteFeedback } from '../../lib/haptics';
import type { DeletionState, PendingDeletion } from './pendingDeletion';

/** Wie lange ein Loeschvorgang rueckgaengig gemacht werden kann. */
const UNDO_WINDOW_MS = 8000;

export function usePendingDeletion<TId>(onCommit: (id: TId) => Promise<void>) {
  const [state, setState] = useState<DeletionState<TId>>(EMPTY_DELETION_STATE);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stateRef = useRef<DeletionState<TId>>(EMPTY_DELETION_STATE);
  const onCommitRef = useRef(onCommit);

  onCommitRef.current = onCommit;
  stateRef.current = state;

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const runCommit = useCallback((id: TId | null) => {
    if (id === null) {
      return;
    }
    onCommitRef.current(id).catch((error: unknown) => {
      console.error('[Loeschen] Vorgang konnte nicht ausgefuehrt werden:', error);
    });
  }, []);

  const requestDelete = useCallback(
    (entry: PendingDeletion<TId>) => {
      // Das Ticken gehoert hierher und nicht in die Wischgeste: Geloescht wird
      // auch ueber den Knopf in der Karte, und beide Wege sollen sich gleich
      // anfuehlen.
      deleteFeedback();
      clearTimer();
      const outcome = requestDeletion(stateRef.current, entry);
      stateRef.current = outcome.state;
      setState(outcome.state);
      runCommit(outcome.commit);

      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        const expired = commitDeletion(stateRef.current);
        stateRef.current = expired.state;
        setState(expired.state);
        runCommit(expired.commit);
      }, UNDO_WINDOW_MS);
    },
    [clearTimer, runCommit]
  );

  const undo = useCallback(() => {
    clearTimer();
    const outcome = undoDeletion(stateRef.current);
    stateRef.current = outcome.state;
    setState(outcome.state);
  }, [clearTimer]);

  // Beim Verlassen des Bildschirms wird ausgefuehrt, nicht zurueckgenommen: Die
  // Zeile ist aus der Liste verschwunden, sie unbemerkt zurueckzuholen waere
  // schlimmer als das Loeschen zu vollziehen.
  useEffect(
    () => () => {
      clearTimer();
      const outcome = commitDeletion(stateRef.current);
      stateRef.current = outcome.state;
      runCommit(outcome.commit);
    },
    [clearTimer, runCommit]
  );

  return { pending: state.pending, requestDelete, undo };
}
