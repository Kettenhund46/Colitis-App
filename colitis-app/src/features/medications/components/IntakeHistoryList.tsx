import { FlatList, Pressable, Text, View, StyleSheet } from 'react-native';
import {
  formatDayHeading,
  formatDaySummaryLabel,
  formatIntakeTime,
  medicationNameById,
} from '../adherence';
import { Card } from '../../../components/ui/Card';
import { useTheme } from '../../../theme/ThemeContext';
import { tokens } from '../../../styles/tokens';
import type { DaySummary } from '../adherence';
import type { Medication } from '../types';
import type { ThemeColors } from '../../../theme/types';

interface IntakeHistoryListProps {
  summaries: DaySummary[];
  medications: Medication[];
  expandedDate: string | null;
  onToggleDate: (date: string) => void;
  onDeleteIntake: (intakeId: number) => void;
}

export function IntakeHistoryList({
  summaries,
  medications,
  expandedDate,
  onToggleDate,
  onDeleteIntake,
}: IntakeHistoryListProps) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);

  return (
    <FlatList
      style={styles.list}
      contentContainerStyle={styles.listContent}
      data={summaries}
      keyExtractor={(summary) => summary.date}
      renderItem={({ item }) => {
        const isExpanded = item.date === expandedDate;
        return (
          <Card accent={item.isComplete ? 'good' : 'warning'}>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ expanded: isExpanded }}
              accessibilityLabel={`${formatDayHeading(item.date)}: ${formatDaySummaryLabel(item)}`}
              style={styles.dayRow}
              onPress={() => onToggleDate(item.date)}
            >
              <Text style={styles.dayHeading}>{formatDayHeading(item.date)}</Text>
              <Text style={item.isComplete ? styles.completeText : styles.missingText}>
                {formatDaySummaryLabel(item)}
              </Text>
            </Pressable>

            {isExpanded && (
              <View style={styles.intakeBlock}>
                {item.intakes.length === 0 ? (
                  <Text style={styles.noIntakeText}>An diesem Tag wurde nichts erfasst.</Text>
                ) : (
                  item.intakes.map((intake) => (
                    <View key={intake.id} style={styles.intakeRow}>
                      <Text style={styles.intakeText}>
                        {medicationNameById(medications, intake.medicationId)} —{' '}
                        {formatIntakeTime(intake.takenAt)}
                      </Text>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`Einnahme um ${formatIntakeTime(intake.takenAt)} entfernen`}
                        style={styles.deleteButton}
                        onPress={() => onDeleteIntake(intake.id)}
                      >
                        <Text style={styles.deleteButtonText}>Entfernen</Text>
                      </Pressable>
                    </View>
                  ))
                )}
              </View>
            )}
          </Card>
        );
      }}
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
    intakeBlock: {
      marginTop: tokens.spacing.sm,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      paddingTop: tokens.spacing.sm,
      gap: tokens.spacing.xs,
    },
    noIntakeText: { color: colors.textSecondary, fontSize: tokens.typography.fontSize.sm },
    intakeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: tokens.spacing.sm,
    },
    intakeText: { color: colors.textPrimary, fontSize: tokens.typography.fontSize.sm, flexShrink: 1 },
    deleteButton: {
      borderRadius: tokens.radius.sm,
      borderWidth: 1,
      borderColor: colors.danger,
      paddingVertical: tokens.spacing.xs,
      paddingHorizontal: tokens.spacing.sm,
    },
    deleteButtonText: { color: colors.danger, fontSize: tokens.typography.fontSize.sm },
  });
}
