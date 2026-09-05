import { SectionList, Text, View, StyleSheet } from 'react-native';
import { formatMealTime, groupByDay } from '../meals';
import { formatGermanDate } from '../../doctorVisits/doctorVisitPassBuilder';
import { Card } from '../../../components/ui/Card';
import { SwipeableRow } from '../../../components/swipe/SwipeableRow';
import { useTheme } from '../../../theme/ThemeContext';
import { tokens } from '../../../styles/tokens';
import type { Meal } from '../types';
import type { ThemeColors } from '../../../theme/types';

interface MealListProps {
  meals: Meal[];
  onDelete: (meal: Meal) => void;
}

export function MealList({ meals, onDelete }: MealListProps) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);

  const sections = [...groupByDay(meals)].map(([date, dayMeals]) => ({
    title: formatGermanDate(date),
    data: dayMeals,
  }));

  return (
    <SectionList
      style={styles.list}
      contentContainerStyle={styles.listContent}
      sections={sections}
      keyExtractor={(meal) => String(meal.id)}
      stickySectionHeadersEnabled={false}
      renderSectionHeader={({ section }) => (
        <Text style={styles.dayHeading}>{section.title}</Text>
      )}
      renderItem={({ item }) => (
        <SwipeableRow onDelete={() => onDelete(item)}>
          <Card accent="neutral">
            <View style={styles.row}>
              <Text style={styles.time}>{formatMealTime(item)}</Text>
              <Text style={styles.description}>{item.description}</Text>
            </View>
          </Card>
        </SwipeableRow>
      )}
    />
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    list: { flex: 1, backgroundColor: colors.background },
    listContent: { padding: tokens.spacing.lg, gap: tokens.spacing.sm, paddingBottom: tokens.spacing.xxl },
    dayHeading: {
      color: colors.textSecondary,
      fontSize: tokens.typography.fontSize.sm,
      fontWeight: tokens.typography.fontWeight.bold,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginTop: tokens.spacing.md,
      marginBottom: tokens.spacing.xs,
    },
    row: { flexDirection: 'row', gap: tokens.spacing.md, alignItems: 'baseline' },
    // Die Uhrzeit steht in fester Breite links: So bilden die Mahlzeiten eines
    // Tages eine Spalte, statt beliebig einzurutschen.
    time: {
      color: colors.textSecondary,
      fontSize: tokens.typography.fontSize.sm,
      fontVariant: ['tabular-nums'],
      width: 48,
    },
    description: {
      color: colors.textPrimary,
      fontSize: tokens.typography.fontSize.md,
      flexShrink: 1,
    },
  });
}
