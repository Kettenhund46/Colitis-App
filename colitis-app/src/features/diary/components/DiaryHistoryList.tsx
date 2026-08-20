import { FlatList, Pressable, Text, View, StyleSheet } from 'react-native';
import { useTheme } from '../../../theme/ThemeContext';
import { tokens } from '../../../styles/tokens';
import { STOOL_CONSISTENCY_OPTIONS, SYMPTOM_OPTIONS, labelFor, buildTriggerLabels } from '../constants';
import { formatOccurredAt } from '../formatting';
import { buildDayRatings, formatDateKey } from '../calendarLogic';
import { RatingIndicator, RATING_LABELS } from './RatingIndicator';
import type { DiaryEntryWithTriggers } from '../types';
import type { DayRating } from '../calendarLogic';
import type { ThemeColors } from '../../../theme/types';

interface DiaryHistoryListProps {
  entries: DiaryEntryWithTriggers[];
  onDelete: (entryId: number) => void;
}

export function DiaryHistoryList({ entries, onDelete }: DiaryHistoryListProps) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const dayRatings = buildDayRatings(entries);

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
      renderItem={({ item }) => {
        const rating = dayRatings.get(formatDateKey(new Date(item.occurredAt)));

        return (
          <View
            style={styles.card}
            accessibilityRole="text"
            accessibilityLabel={buildCardAccessibilityLabel(item, rating)}
          >
            <View style={styles.cardHeader}>
              <Text style={styles.cardDate}>{formatOccurredAt(item.occurredAt)}</Text>
              {rating !== undefined && (
                <View style={styles.ratingBadge}>
                  <RatingIndicator rating={rating} />
                  <Text style={styles.ratingText}>Tag: {RATING_LABELS[rating]}</Text>
                </View>
              )}
            </View>
            <Text style={styles.cardDetail}>
              Stuhlgang: {item.stoolFrequency}× · {labelFor(STOOL_CONSISTENCY_OPTIONS, item.stoolConsistency)}
            </Text>
            <Text style={styles.cardDetail}>Schmerzlevel: {item.painLevel}/10</Text>
            {item.hasBlood && <Text style={styles.cardWarning}>Blut im Stuhl</Text>}
            {item.triggerCategories.length > 0 && (
              <Text style={styles.cardDetail}>
                Auslöser: {buildTriggerLabels(item.triggerCategories, item.foodTriggerNote).join(', ')}
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
        );
      }}
    />
  );
}

function buildCardAccessibilityLabel(
  entry: DiaryEntryWithTriggers,
  rating: DayRating | undefined
): string {
  const ratingPart = rating === undefined ? '' : `, Tag: ${RATING_LABELS[rating]}`;
  return `Eintrag vom ${formatOccurredAt(entry.occurredAt)}${ratingPart}`;
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    list: {
      flex: 1,
      backgroundColor: colors.background,
    },
    listContent: {
      padding: tokens.spacing.lg,
    },
    emptyContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: tokens.spacing.lg,
      backgroundColor: colors.background,
    },
    emptyText: {
      color: colors.textSecondary,
      fontSize: tokens.typography.fontSize.md,
      textAlign: 'center',
    },
    card: {
      backgroundColor: colors.surface,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      padding: tokens.spacing.md,
      marginBottom: tokens.spacing.md,
    },
    cardHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: tokens.spacing.xs,
    },
    cardDate: {
      color: colors.textPrimary,
      fontSize: tokens.typography.fontSize.md,
      fontWeight: tokens.typography.fontWeight.bold,
    },
    ratingBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: tokens.spacing.xs,
    },
    ratingText: {
      color: colors.textSecondary,
      fontSize: tokens.typography.fontSize.sm,
    },
    cardDetail: {
      color: colors.textSecondary,
      fontSize: tokens.typography.fontSize.sm,
    },
    cardWarning: {
      color: colors.danger,
      fontSize: tokens.typography.fontSize.sm,
      fontWeight: tokens.typography.fontWeight.medium,
    },
    cardNote: {
      color: colors.textPrimary,
      fontSize: tokens.typography.fontSize.sm,
      marginTop: tokens.spacing.xs,
      fontStyle: 'italic',
    },
    deleteButton: {
      alignSelf: 'flex-start',
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.danger,
      paddingVertical: tokens.spacing.xs,
      paddingHorizontal: tokens.spacing.md,
      marginTop: tokens.spacing.sm,
    },
    deleteButtonText: {
      color: colors.danger,
      fontSize: tokens.typography.fontSize.sm,
    },
  });
}
