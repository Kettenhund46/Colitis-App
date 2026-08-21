import { View, StyleSheet } from 'react-native';
import { GhostCard } from './GhostCard';
import { useTheme } from '../../theme/ThemeContext';
import { tokens } from '../../styles/tokens';
import type { ThemeColors } from '../../theme/types';

const DEFAULT_COUNT = 3;

interface SkeletonListProps {
  /** Wie viele Platzhalterkarten. */
  count?: number;
  /** Wie viele Textzeilen je Karte. */
  lines?: number;
}

export function SkeletonList({ count = DEFAULT_COUNT, lines = 2 }: SkeletonListProps) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const cardIndexes = Array.from({ length: Math.max(count, 1) }, (_, index) => index);

  return (
    <View
      style={styles.container}
      accessibilityRole="progressbar"
      accessibilityLabel="Inhalte werden geladen"
    >
      {cardIndexes.map((index) => (
        <GhostCard key={index} lines={lines} />
      ))}
    </View>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      flex: 1,
      padding: tokens.spacing.lg,
      gap: tokens.spacing.md,
      backgroundColor: colors.background,
    },
  });
}
