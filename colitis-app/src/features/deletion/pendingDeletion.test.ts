import { describe, it, expect } from 'vitest';
import {
  EMPTY_DELETION_STATE,
  requestDeletion,
  undoDeletion,
  commitDeletion,
} from './pendingDeletion';
import type { DeletionState } from './pendingDeletion';

const emptyState: DeletionState<number> = EMPTY_DELETION_STATE;

describe('requestDeletion', () => {
  it('parks the entry without deleting anything yet', () => {
    const outcome = requestDeletion(emptyState, { id: 7, label: 'Eintrag' });
    expect(outcome.state.pending).toEqual({ id: 7, label: 'Eintrag' });
    expect(outcome.commit).toBeNull();
  });

  it('commits the waiting entry when a second one is deleted', () => {
    const first = requestDeletion(emptyState, { id: 7, label: 'Eintrag' });
    const second = requestDeletion(first.state, { id: 9, label: 'Eintrag' });
    expect(second.commit).toBe(7);
    expect(second.state.pending).toEqual({ id: 9, label: 'Eintrag' });
  });

  it('leaves the given state untouched', () => {
    const outcome = requestDeletion(emptyState, { id: 7, label: 'Eintrag' });
    expect(emptyState.pending).toBeNull();
    expect(outcome.state).not.toBe(emptyState);
  });
});

describe('undoDeletion', () => {
  it('drops the waiting entry without ever deleting it', () => {
    const parked = requestDeletion(emptyState, { id: 7, label: 'Eintrag' });
    const outcome = undoDeletion(parked.state);
    expect(outcome.state.pending).toBeNull();
    expect(outcome.commit).toBeNull();
    expect(outcome.state).not.toBe(parked.state);
  });

  it('does nothing when nothing is waiting', () => {
    const outcome = undoDeletion(emptyState);
    expect(outcome.state.pending).toBeNull();
    expect(outcome.commit).toBeNull();
    expect(outcome.state).toBe(emptyState);
  });
});

describe('commitDeletion', () => {
  it('hands back the id that must now be deleted', () => {
    const parked = requestDeletion(emptyState, { id: 7, label: 'Eintrag' });
    const outcome = commitDeletion(parked.state);
    expect(outcome.commit).toBe(7);
    expect(outcome.state.pending).toBeNull();
  });

  it('has nothing to commit when nothing is waiting', () => {
    const outcome = commitDeletion(emptyState);
    expect(outcome.commit).toBeNull();
    expect(outcome.state.pending).toBeNull();
  });
});
