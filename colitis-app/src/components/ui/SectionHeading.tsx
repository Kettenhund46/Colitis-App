import { Text, StyleSheet } from 'react-native';
import { useTheme } from '../../theme/ThemeContext';
import { tokens } from '../../styles/tokens';
import type { ThemeColors } from '../../theme/types';

interface SectionHeadingProps {
  children: string;
}

export function SectionHeading({ children }: SectionHeadingProps) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  return <Text style={styles.heading}>{children}</Text>;
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    heading: {
      color: colors.textPrimary,
      fontSize: tokens.typography.fontSize.lg,
      fontWeight: tokens.typography.fontWeight.bold,
      marginTop: tokens.spacing.lg,
      marginBottom: tokens.spacing.sm,
    },
  });
}
