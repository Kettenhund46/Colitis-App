import { describe, it, expect } from 'vitest';
import { TAB_ORDER, getNeighbourTab, tabPath, directionForEdge } from './tabOrder';

describe('TAB_ORDER', () => {
  it('lists the five tabs in tab-bar order', () => {
    expect(TAB_ORDER).toEqual(['tagebuch', 'wissen', 'medikamente', 'toiletten', 'einstellungen']);
  });
});

describe('getNeighbourTab', () => {
  it('returns the following tab for direction "next"', () => {
    expect(getNeighbourTab('tagebuch', 'next')).toBe('wissen');
    expect(getNeighbourTab('medikamente', 'next')).toBe('toiletten');
  });

  it('returns the preceding tab for direction "previous"', () => {
    expect(getNeighbourTab('wissen', 'previous')).toBe('tagebuch');
    expect(getNeighbourTab('einstellungen', 'previous')).toBe('toiletten');
  });

  it('returns null before the first tab', () => {
    expect(getNeighbourTab('tagebuch', 'previous')).toBeNull();
  });

  it('returns null after the last tab', () => {
    expect(getNeighbourTab('einstellungen', 'next')).toBeNull();
  });

  it('returns null for an unknown tab name in either direction', () => {
    expect(getNeighbourTab('gibtesnicht', 'next')).toBeNull();
    expect(getNeighbourTab('gibtesnicht', 'previous')).toBeNull();
  });

  it('returns null for an empty tab name', () => {
    expect(getNeighbourTab('', 'next')).toBeNull();
  });

  it('returns the correct "next" neighbour for every adjacent pair in TAB_ORDER', () => {
    for (let index = 0; index < TAB_ORDER.length - 1; index += 1) {
      const current = TAB_ORDER[index];
      const expectedNext = TAB_ORDER[index + 1];
      expect(getNeighbourTab(current, 'next')).toBe(expectedNext);
    }
  });

  it('returns the correct "previous" neighbour for every adjacent pair in TAB_ORDER', () => {
    for (let index = 1; index < TAB_ORDER.length; index += 1) {
      const current = TAB_ORDER[index];
      const expectedPrevious = TAB_ORDER[index - 1];
      expect(getNeighbourTab(current, 'previous')).toBe(expectedPrevious);
    }
  });
});

describe('tabPath', () => {
  it('maps a tab name to its route path', () => {
    expect(tabPath('wissen')).toBe('/wissen');
    expect(tabPath('einstellungen')).toBe('/einstellungen');
  });

  it('maps every tab in TAB_ORDER to its route path', () => {
    for (const tab of TAB_ORDER) {
      expect(tabPath(tab)).toBe(`/${tab}`);
    }
  });
});

describe('directionForEdge', () => {
  it('maps the left edge to "previous"', () => {
    expect(directionForEdge('left')).toBe('previous');
  });

  it('maps the right edge to "next"', () => {
    expect(directionForEdge('right')).toBe('next');
  });
});
