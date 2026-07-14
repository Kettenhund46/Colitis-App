const colors = {
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
} as const;

const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

const typography = {
  fontSize: {
    sm: 14,
    md: 16,
    lg: 20,
    xl: 28,
    xxl: 36,
  },
  fontWeight: {
    regular: '400',
    medium: '500',
    bold: '700',
  },
} as const;

export const tokens = { colors, spacing, typography } as const;
