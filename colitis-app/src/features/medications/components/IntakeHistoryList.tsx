import { FlatList, Text, View, StyleSheet } from 'react-native';
import { formatDayHeading, formatDaySummaryLabel } from '../adherence';
import { Card } from '../../../components/ui/Card';
import { useTheme } from '../../../theme/ThemeContext';
import { tokens } from '../../../styles/tokens';
import type { DaySummary } from '../adherence';
import type { ThemeColors } from '../../../theme/types';

interface IntakeHistoryListProps {
  summaries: DaySummary[];
}

export function IntakeHistoryList({ summaries }: IntakeHistoryListProps) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);

  return (
    <FlatList
      style={styles.list}
      contentContainerStyle={styles.listContent}
      data={summaries}
      keyExtractor={(summary) => summary.date}
      renderItem={({ item }) => (
        <Card accent={item.isComplete ? 'good' : 'warning'}>
          <View style={styles.dayRow}>
            <Text style={styles.dayHeading}>{formatDayHeading(item.date)}</Text>
            <Text style={item.isComplete ? styles.completeText : styles.missingText}>
              {formatDaySummaryLabel(item)}
            </Text>
          </View>
        </Card>
      )}
    />
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    list: { flex: 1, backgroundColor: colors.background },
    listContent: { padding: tokens.spacing.lg, gap: tokens.spacing.md },
    dayRow: { gap: tokens.spacing.xs },
    dayHeading: {
      color: colors.textPrimary,
      fontSize: tokens.typography.fontSize.md,
      fontWeight: tokens.typography.fontWeight.bold,
    },
    completeText: { color: colors.success, fontSize: tokens.typography.fontSize.sm },
    missingText: { color: colors.danger, fontSize: tokens.typography.fontSize.sm },
  });
}
