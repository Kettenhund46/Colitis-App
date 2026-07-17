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

const radius = {
  sm: 8,
  md: 12,
  pill: 20,
} as const;

export const tokens = { spacing, typography, radius } as const;
