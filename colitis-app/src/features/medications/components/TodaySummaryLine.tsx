import { Text, View, StyleSheet } from 'react-native';
import { formatTodaySummaryLabel } from '../adherence';
import { useTheme } from '../../../theme/ThemeContext';
import { tokens } from '../../../styles/tokens';
import type { TodaySummary } from '../adherence';
import type { ThemeColors } from '../../../theme/types';

interface TodaySummaryLineProps {
  summary: TodaySummary | null;
}

export function TodaySummaryLine({ summary }: TodaySummaryLineProps) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);

  if (summary === null) {
    return null;
  }

  const label = formatTodaySummaryLabel(summary);
  if (label === null) {
    return null;
  }

  const isComplete = summary.open.length === 0;

  return (
    <View style={styles.line}>
      <Text style={isComplete ? styles.completeText : styles.openText}>{label}</Text>
    </View>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    line: {
      paddingHorizontal: tokens.spacing.lg,
      paddingTop: tokens.spacing.md,
    },
    openText: {
      color: colors.textPrimary,
      fontSize: tokens.typography.fontSize.sm,
      fontWeight: tokens.typography.fontWeight.medium,
    },
    completeText: {
      color: colors.success,
      fontSize: tokens.typography.fontSize.sm,
      fontWeight: tokens.typography.fontWeight.medium,
    },
  });
}
