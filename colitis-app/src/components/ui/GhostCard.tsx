import { View, StyleSheet } from 'react-native';
import { Card } from './Card';
import { useTheme } from '../../theme/ThemeContext';
import { tokens } from '../../styles/tokens';
import type { ThemeColors } from '../../theme/types';

const DEFAULT_LINES = 2;
const LINE_HEIGHT = 9;
/** Zeilenbreiten in Prozent, damit der Block nicht wie ein Rechteck wirkt. */
const LINE_WIDTHS = ['100%', '62%', '78%'] as const;

interface GhostCardProps {
  /** Wie viele Textzeilen angedeutet werden. */
  lines?: number;
  /** Kopfzeile mit Titelbalken und Marke rechts, wie in der Tagebuch-Karte. */
  hasHeaderBadge?: boolean;
}

export function GhostCard({ lines = DEFAULT_LINES, hasHeaderBadge = true }: GhostCardProps) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const lineIndexes = Array.from({ length: Math.max(lines, 1) }, (_, index) => index);

  return (
    <Card accent="neutral">
      {hasHeaderBadge && (
        <View style={styles.header}>
          <View style={[styles.bar, styles.title]} />
          <View style={[styles.bar, styles.badge]} />
        </View>
      )}
      {lineIndexes.map((index) => (
        <View
          key={index}
          style={[
            styles.bar,
            styles.line,
            { width: LINE_WIDTHS[index % LINE_WIDTHS.length] },
          ]}
        />
      ))}
    </Card>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: tokens.spacing.sm,
    },
    bar: {
      backgroundColor: colors.border,
      borderRadius: tokens.radius.sm / 2,
      height: LINE_HEIGHT,
    },
    title: { width: '48%' },
    badge: { width: 44 },
    line: { marginTop: tokens.spacing.xs },
  });
}
