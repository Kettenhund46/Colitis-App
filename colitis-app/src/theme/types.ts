export type ThemeId = 'light' | 'dark' | 'light-blue';

export interface ThemeColors {
  background: string;
  surface: string;
  textPrimary: string;
  textSecondary: string;
  primary: string;
  accent: string;
  danger: string;
  warning: string;
  success: string;
  border: string;
  /** Deutlicher als border -- fuer die neutrale Zustandskante, die sich sonst
   *  im dunklen Theme nicht vom Rahmen der Karte unterscheidet. */
  borderStrong: string;
  overlay: string;
}
