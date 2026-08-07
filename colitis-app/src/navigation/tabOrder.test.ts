import { describe, it, expect } from 'vitest';
import { TAB_ORDER, getNeighbourTab, tabPath } from './tabOrder';

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
});

describe('tabPath', () => {
  it('maps a tab name to its route path', () => {
    expect(tabPath('wissen')).toBe('/wissen');
    expect(tabPath('einstellungen')).toBe('/einstellungen');
  });
});
