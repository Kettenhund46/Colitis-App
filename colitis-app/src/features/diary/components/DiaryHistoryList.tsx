import { FlatList, Text, View, StyleSheet } from 'react-native';
import { tokens } from '../../../styles/tokens';
import { STOOL_CONSISTENCY_OPTIONS, TRIGGER_CATEGORY_OPTIONS } from '../constants';
import type { SelectOption } from '../constants';
import type { DiaryEntryWithTriggers } from '../types';

interface DiaryHistoryListProps {
  entries: DiaryEntryWithTriggers[];
}

function labelFor(options: SelectOption<string>[], key: string): string {
  return options.find((option) => option.key === key)?.label ?? key;
}

function formatOccurredAt(occurredAt: string): string {
  return new Date(occurredAt).toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function DiaryHistoryList({ entries }: DiaryHistoryListProps) {
  if (entries.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>
          Noch keine Einträge. Tippe auf „+“, um deinen ersten Eintrag anzulegen.
        </Text>
      </View>
    );
  }

  return (
    <FlatList
      style={styles.list}
      contentContainerStyle={styles.listContent}
      data={entries}
      keyExtractor={(entry) => String(entry.id)}
      renderItem={({ item }) => (
        <View style={styles.card}>
          <Text style={styles.cardDate}>{formatOccurredAt(item.occurredAt)}</Text>
          <Text style={styles.cardDetail}>
            Stuhlgang: {item.stoolFrequency}× · {labelFor(STOOL_CONSISTENCY_OPTIONS, item.stoolConsistency)}
          </Text>
          <Text style={styles.cardDetail}>Schmerzlevel: {item.painLevel}/10</Text>
          {item.hasBlood && <Text style={styles.cardWarning}>Blut im Stuhl</Text>}
          {item.triggerCategories.length > 0 && (
            <Text style={styles.cardDetail}>
              Auslöser: {item.triggerCategories.map((category) => labelFor(TRIGGER_CATEGORY_OPTIONS, category)).join(', ')}
            </Text>
          )}
          {item.note && <Text style={styles.cardNote}>{item.note}</Text>}
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  list: {
    flex: 1,
    backgroundColor: tokens.colors.background,
  },
  listContent: {
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
  cardDate: {
    color: tokens.colors.textPrimary,
    fontSize: tokens.typography.fontSize.md,
    fontWeight: tokens.typography.fontWeight.bold,
    marginBottom: tokens.spacing.xs,
  },
  cardDetail: {
    color: tokens.colors.textSecondary,
    fontSize: tokens.typography.fontSize.sm,
  },
  cardWarning: {
    color: tokens.colors.danger,
    fontSize: tokens.typography.fontSize.sm,
    fontWeight: tokens.typography.fontWeight.medium,
  },
  cardNote: {
    color: tokens.colors.textPrimary,
    fontSize: tokens.typography.fontSize.sm,
    marginTop: tokens.spacing.xs,
    fontStyle: 'italic',
  },
});
