import { describe, it, expect } from 'vitest';
import { isDeleteSwipe, startedInEdgeStrip, EDGE_WIDTH, ROW_SWIPE_THRESHOLD } from './swipeDecision';

const WIDTH = 400;

describe('startedInEdgeStrip', () => {
  it('recognises both edges', () => {
    expect(startedInEdgeStrip(5, WIDTH)).toBe(true);
    expect(startedInEdgeStrip(WIDTH - 5, WIDTH)).toBe(true);
  });

  it('leaves the middle alone', () => {
    expect(startedInEdgeStrip(200, WIDTH)).toBe(false);
  });
});

describe('isDeleteSwipe', () => {
  it('accepts a long leftward drag that started in the middle', () => {
    expect(isDeleteSwipe({ startX: 200, dx: -120, dy: 5, screenWidth: WIDTH })).toBe(true);
  });

  it('refuses a drag that started in the edge strip, so the tab gesture owns it alone', () => {
    expect(isDeleteSwipe({ startX: 5, dx: -120, dy: 5, screenWidth: WIDTH })).toBe(false);
    expect(isDeleteSwipe({ startX: WIDTH - 5, dx: -120, dy: 5, screenWidth: WIDTH })).toBe(false);
  });

  it('refuses a rightward drag', () => {
    expect(isDeleteSwipe({ startX: 200, dx: 120, dy: 5, screenWidth: WIDTH })).toBe(false);
  });

  it('refuses a mostly vertical drag, so scrolling still works', () => {
    expect(isDeleteSwipe({ startX: 200, dx: -120, dy: -130, screenWidth: WIDTH })).toBe(false);
  });

  it('refuses a drag short of the threshold', () => {
    expect(isDeleteSwipe({ startX: 200, dx: -(ROW_SWIPE_THRESHOLD - 1), dy: 5, screenWidth: WIDTH })).toBe(false);
  });

  it('keeps the delete threshold above the tab gesture threshold of 60', () => {
    expect(ROW_SWIPE_THRESHOLD).toBeGreaterThan(60);
  });

  it('uses the same edge strip the tab gesture uses', () => {
    expect(EDGE_WIDTH).toBe(25);
  });
});
