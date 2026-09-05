import { FlatList, Text, View, StyleSheet } from 'react-native';
import { formatMealTime, localDayOf } from '../meals';
import { CORRELATION_NOTE } from '../mealCorrelation';
import { formatGermanDate } from '../../doctorVisits/doctorVisitPassBuilder';
import { Card } from '../../../components/ui/Card';
import { useTheme } from '../../../theme/ThemeContext';
import { tokens } from '../../../styles/tokens';
import type { BadDayMeals } from '../mealCorrelation';
import type { Meal } from '../types';
import type { ThemeColors } from '../../../theme/types';

interface BadDayMealsViewProps {
  days: BadDayMeals[];
}

/**
 * Ob die Mahlzeit vom Vortag stammt. Ohne diesen Zusatz laesst sich eine
 * Uhrzeit im Fenster nicht einordnen -- 19:00 kann gestern oder heute sein.
 */
function dayHintFor(meal: Meal, badDay: string): string {
  return localDayOf(meal) === badDay ? '' : ' (Vortag)';
}

export function BadDayMealsView({ days }: BadDayMealsViewProps) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);

  return (
    <FlatList
      style={styles.list}
      contentContainerStyle={styles.listContent}
      data={days}
      keyExtractor={(day) => day.date}
      ListHeaderComponent={<Text style={styles.note}>{CORRELATION_NOTE}</Text>}
      renderItem={({ item }) => (
        <Card accent="warning">
          <Text style={styles.dayHeading}>{formatGermanDate(item.date)}</Text>
          <Text style={styles.subHeading}>Davor erfasst:</Text>
          {item.meals.map((meal) => (
            <View key={meal.id} style={styles.row}>
              <Text style={styles.time}>
                {formatMealTime(meal)}
                {dayHintFor(meal, item.date)}
              </Text>
              <Text style={styles.description}>{meal.description}</Text>
            </View>
          ))}
        </Card>
      )}
    />
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    list: { flex: 1, backgroundColor: colors.background },
    listContent: {
      padding: tokens.spacing.lg,
      gap: tokens.spacing.md,
      paddingBottom: tokens.spacing.xxl,
    },
    note: {
      color: colors.textSecondary,
      fontSize: tokens.typography.fontSize.sm,
      fontStyle: 'italic',
      lineHeight: 20,
      marginBottom: tokens.spacing.sm,
    },
    dayHeading: {
      color: colors.textPrimary,
      fontSize: tokens.typography.fontSize.lg,
      fontWeight: tokens.typography.fontWeight.bold,
    },
    subHeading: {
      color: colors.textSecondary,
      fontSize: tokens.typography.fontSize.sm,
      marginTop: tokens.spacing.xs,
      marginBottom: tokens.spacing.sm,
    },
    row: { flexDirection: 'row', gap: tokens.spacing.md, alignItems: 'baseline', marginBottom: 2 },
    time: {
      color: colors.textSecondary,
      fontSize: tokens.typography.fontSize.sm,
      fontVariant: ['tabular-nums'],
      width: 92,
    },
    description: {
      color: colors.textPrimary,
      fontSize: tokens.typography.fontSize.sm,
      flexShrink: 1,
      lineHeight: 20,
    },
  });
}
