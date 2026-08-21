import { useState } from 'react';
import { Pressable, ScrollView, Text, View, StyleSheet } from 'react-native';
import { useTheme } from '../../../theme/ThemeContext';
import { tokens } from '../../../styles/tokens';
import { EmptyState } from '../../../components/ui/EmptyState';
import { buildDailyTrend } from '../trendLogic';
import type { DailyTrendPoint, TrendRangeDays } from '../trendLogic';
import type { DiaryEntryWithTriggers } from '../types';
import type { ThemeColors } from '../../../theme/types';

interface DiaryTrendChartProps {
  entries: DiaryEntryWithTriggers[];
}

const RANGE_OPTIONS: { value: TrendRangeDays; label: string }[] = [
  { value: 7, label: '7 Tage' },
  { value: 30, label: '30 Tage' },
  { value: 90, label: '90 Tage' },
];

const BAR_WIDTH = 8;
const BAR_GAP = 3;
const BAR_RADIUS = 2;
const CHART_HEIGHT = 80;
const MIN_STOOL_FREQUENCY_SCALE = 5;
const PAIN_LEVEL_SCALE = 10;

function formatShortDate(dateKey: string): string {
  const [, month, day] = dateKey.split('-');
  return `${day}.${month}.`;
}

function barHeight(value: number | null, maxValue: number): number {
  if (value === null || maxValue === 0) {
    return 0;
  }
  return Math.max(1, Math.round((value / maxValue) * CHART_HEIGHT));
}

function resolveStoolFrequencyMax(days: DailyTrendPoint[]): number {
  const values = days
    .map((day) => day.totalStoolFrequency)
    .filter((value): value is number => value !== null);
  if (values.length === 0) {
    return MIN_STOOL_FREQUENCY_SCALE;
  }
  return Math.max(MIN_STOOL_FREQUENCY_SCALE, ...values);
}

function hasAnyData(days: DailyTrendPoint[]): boolean {
  return days.some((day) => day.worstPainLevel !== null || day.totalStoolFrequency !== null);
}

const barRowStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: CHART_HEIGHT,
  },
  barSlot: {
    width: BAR_WIDTH,
    marginRight: BAR_GAP,
    justifyContent: 'flex-end',
  },
  bar: {
    width: BAR_WIDTH,
    borderRadius: BAR_RADIUS,
  },
});

interface BarRowProps {
  days: DailyTrendPoint[];
  valueKey: 'worstPainLevel' | 'totalStoolFrequency';
  maxValue: number;
  barColor: string;
}

function BarRow({ days, valueKey, maxValue, barColor }: BarRowProps) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      <View style={barRowStyles.row}>
        {days.map((day) => (
          <View key={day.date} style={barRowStyles.barSlot}>
            <View style={[barRowStyles.bar, { height: barHeight(day[valueKey], maxValue), backgroundColor: barColor }]} />
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

export function DiaryTrendChart({ entries }: DiaryTrendChartProps) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const [rangeDays, setRangeDays] = useState<TrendRangeDays>(7);

  const days = buildDailyTrend(entries, rangeDays);
  const stoolFrequencyMax = resolveStoolFrequencyMax(days);

  return (
    <View style={styles.container}>
      <View style={styles.toggleRow}>
        {RANGE_OPTIONS.map((option) => {
          const isSelected = rangeDays === option.value;
          return (
            <Pressable
              key={option.value}
              accessibilityRole="button"
              accessibilityState={{ selected: isSelected }}
              style={[styles.toggleButton, isSelected && styles.toggleButtonActive]}
              onPress={() => setRangeDays(option.value)}
            >
              <Text style={[styles.toggleButtonText, isSelected && styles.toggleButtonTextActive]}>
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {hasAnyData(days) ? (
        <>
          <Text style={styles.chartTitle}>Schmerzlevel</Text>
          <BarRow days={days} valueKey="worstPainLevel" maxValue={PAIN_LEVEL_SCALE} barColor={colors.danger} />

          <Text style={styles.chartTitle}>Stuhlgang-Häufigkeit</Text>
          <BarRow days={days} valueKey="totalStoolFrequency" maxValue={stoolFrequencyMax} barColor={colors.primary} />

          <View style={styles.dateRangeRow}>
            <Text style={styles.dateRangeText}>{formatShortDate(days[0].date)}</Text>
            <Text style={styles.dateRangeText}>{formatShortDate(days[days.length - 1].date)}</Text>
          </View>
        </>
      ) : (
        <EmptyState
          title="Keine Daten in diesem Zeitraum"
          description="Wähle einen anderen Zeitraum, oder erfasse Einträge für diese Tage."
          showGhost={false}
        />
      )}
    </View>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      padding: tokens.spacing.lg,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    toggleRow: {
      flexDirection: 'row',
      gap: tokens.spacing.xs,
      marginBottom: tokens.spacing.md,
    },
    toggleButton: {
      paddingVertical: tokens.spacing.xs,
      paddingHorizontal: tokens.spacing.md,
      borderRadius: tokens.radius.pill,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    toggleButtonActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    toggleButtonText: {
      color: colors.textPrimary,
      fontSize: tokens.typography.fontSize.sm,
    },
    toggleButtonTextActive: {
      color: colors.surface,
    },
    chartTitle: {
      color: colors.textPrimary,
      fontSize: tokens.typography.fontSize.sm,
      fontWeight: tokens.typography.fontWeight.medium,
      marginBottom: tokens.spacing.xs,
      marginTop: tokens.spacing.sm,
    },
    dateRangeRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginTop: tokens.spacing.xs,
    },
    dateRangeText: {
      color: colors.textSecondary,
      fontSize: tokens.typography.fontSize.sm,
    },
  });
}
