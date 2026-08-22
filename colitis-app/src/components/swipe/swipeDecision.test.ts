import { describe, it, expect } from 'vitest';
import {
  isDeleteSwipe,
  startedInEdgeStrip,
  shouldClaimRowSwipe,
  EDGE_WIDTH,
  ROW_SWIPE_THRESHOLD,
  ROW_SWIPE_CLAIM_THRESHOLD,
} from './swipeDecision';

const WIDTH = 400;

describe('startedInEdgeStrip', () => {
  it('recognises both edges', () => {
    expect(startedInEdgeStrip(5, WIDTH)).toBe(true);
    expect(startedInEdgeStrip(WIDTH - 5, WIDTH)).toBe(true);
  });

  it('leaves the middle alone', () => {
    expect(startedInEdgeStrip(200, WIDTH)).toBe(false);
  });

  it('counts the last pixel of the strip as inside it', () => {
    expect(startedInEdgeStrip(EDGE_WIDTH, WIDTH)).toBe(true);
    expect(startedInEdgeStrip(WIDTH - EDGE_WIDTH, WIDTH)).toBe(true);
  });

  it('counts the first pixel past the strip as outside it', () => {
    expect(startedInEdgeStrip(EDGE_WIDTH + 1, WIDTH)).toBe(false);
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

  it('accepts a drag of exactly the threshold', () => {
    expect(isDeleteSwipe({ startX: 200, dx: -ROW_SWIPE_THRESHOLD, dy: 5, screenWidth: WIDTH })).toBe(true);
  });

  it('refuses a drag that is exactly as vertical as it is horizontal', () => {
    expect(isDeleteSwipe({ startX: 200, dx: -120, dy: 120, screenWidth: WIDTH })).toBe(false);
  });
});

describe('shouldClaimRowSwipe', () => {
  it('ignores a tap that drifts only a couple of pixels', () => {
    expect(shouldClaimRowSwipe({ startX: 200, dx: -3, dy: 1, screenWidth: WIDTH })).toBe(false);
  });

  it('claims once the drag is clearly a horizontal swipe', () => {
    expect(shouldClaimRowSwipe({ startX: 200, dx: -20, dy: 2, screenWidth: WIDTH })).toBe(true);
  });

  it('claims earlier than it deletes', () => {
    expect(ROW_SWIPE_CLAIM_THRESHOLD).toBeLessThan(ROW_SWIPE_THRESHOLD);
  });

  it('never claims in the edge strip, whatever the distance', () => {
    expect(shouldClaimRowSwipe({ startX: 5, dx: -200, dy: 1, screenWidth: WIDTH })).toBe(false);
  });
});
