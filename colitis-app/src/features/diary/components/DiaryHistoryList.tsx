import { FlatList, Pressable, Text, View, StyleSheet } from 'react-native';
import { tokens } from '../../../styles/tokens';
import { STOOL_CONSISTENCY_OPTIONS, SYMPTOM_OPTIONS, TRIGGER_CATEGORY_OPTIONS, labelFor } from '../constants';
import { formatOccurredAt } from '../formatting';
import type { DiaryEntryWithTriggers } from '../types';

interface DiaryHistoryListProps {
  entries: DiaryEntryWithTriggers[];
  onDelete: (entryId: number) => void;
}

export function DiaryHistoryList({ entries, onDelete }: DiaryHistoryListProps) {
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
          {item.symptoms.length > 0 && (
            <Text style={styles.cardDetail}>
              Symptome: {item.symptoms.map((symptomKey) => labelFor(SYMPTOM_OPTIONS, symptomKey)).join(', ')}
            </Text>
          )}
          {item.note && <Text style={styles.cardNote}>{item.note}</Text>}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Eintrag vom ${formatOccurredAt(item.occurredAt)} löschen`}
            style={styles.deleteButton}
            onPress={() => onDelete(item.id)}
          >
            <Text style={styles.deleteButtonText}>Löschen</Text>
          </Pressable>
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
  deleteButton: {
    alignSelf: 'flex-start',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: tokens.colors.danger,
    paddingVertical: tokens.spacing.xs,
    paddingHorizontal: tokens.spacing.md,
    marginTop: tokens.spacing.sm,
  },
  deleteButtonText: {
    color: tokens.colors.danger,
    fontSize: tokens.typography.fontSize.sm,
  },
});
