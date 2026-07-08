import { Text, View, StyleSheet } from 'react-native';
import { tokens } from '../../../styles/tokens';
import { TRIGGER_CATEGORY_OPTIONS } from '../constants';
import type { TriggerPatternStat } from '../analysis';

interface TriggerAnalysisViewProps {
  patterns: TriggerPatternStat[];
}

function labelForCategory(category: string): string {
  return TRIGGER_CATEGORY_OPTIONS.find((option) => option.key === category)?.label ?? category;
}

export function TriggerAnalysisView({ patterns }: TriggerAnalysisViewProps) {
  if (patterns.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>
          Noch keine Auswertung möglich. Erfasse Einträge mit Auslösern im Tagebuch, um hier Muster zu
          sehen.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.list}>
      {patterns.map((pattern) => (
        <View key={pattern.category} style={styles.card}>
          <Text style={styles.cardTitle}>{labelForCategory(pattern.category)}</Text>
          <Text style={styles.cardDetail}>
            {pattern.entryCount} {pattern.entryCount === 1 ? 'Eintrag' : 'Einträge'}
          </Text>
          <Text style={styles.cardDetail}>Ø Schmerzlevel: {pattern.averagePainLevel}/10</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: {
    padding: tokens.spacing.lg,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: tokens.spacing.lg,
    backgroundColor: tokens.colors.background,
  },
  emptyText: {
    color: tokens.colors.textSecondary,
    fontSize: tokens.typography.fontSize.md,
    textAlign: 'center',
  },
  card: {
    backgroundColor: tokens.colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    padding: tokens.spacing.md,
    marginBottom: tokens.spacing.md,
  },
  cardTitle: {
    color: tokens.colors.textPrimary,
    fontSize: tokens.typography.fontSize.md,
    fontWeight: tokens.typography.fontWeight.bold,
    marginBottom: tokens.spacing.xs,
  },
  cardDetail: {
    color: tokens.colors.textSecondary,
    fontSize: tokens.typography.fontSize.sm,
  },
});
