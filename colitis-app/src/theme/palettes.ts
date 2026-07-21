import type { ThemeColors, ThemeId } from './types';

export const lightColors: ThemeColors = {
  background: '#FBF6EF',
  surface: '#FFFFFF',
  textPrimary: '#2E2A26',
  textSecondary: '#6B6259',
  primary: '#5B8C7B',
  accent: '#D98E4A',
  danger: '#B5533C',
  success: '#5B8C7B',
  border: '#E4DACB',
  overlay: 'rgba(46, 42, 38, 0.4)',
};

export const darkColors: ThemeColors = {
  background: '#1C1A17',
  surface: '#262320',
  textPrimary: '#F3EDE4',
  textSecondary: '#B8AFA3',
  primary: '#7BAF9C',
  accent: '#E3A768',
  danger: '#E07A5F',
  success: '#7BAF9C',
  border: '#3A362F',
  overlay: 'rgba(0, 0, 0, 0.6)',
};

export const lightBlueColors: ThemeColors = {
  background: '#F3F7FB',
  surface: '#FFFFFF',
  textPrimary: '#1D2B36',
  textSecondary: '#5B6B78',
  primary: '#3E7CB1',
  accent: '#6BA3C9',
  danger: '#C1443A',
  success: '#3E7CB1',
  border: '#D7E3ED',
  overlay: 'rgba(29, 43, 54, 0.4)',
};

export const palettes: Record<ThemeId, ThemeColors> = {
  light: lightColors,
  dark: darkColors,
  'light-blue': lightBlueColors,
};
