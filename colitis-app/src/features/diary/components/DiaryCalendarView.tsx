import { useState } from 'react';
import { Pressable, Text, View, StyleSheet } from 'react-native';
import { useTheme } from '../../../theme/ThemeContext';
import { tokens } from '../../../styles/tokens';
import { buildCalendarGrid, groupEntriesByDay, rateDayEntries } from '../calendarLogic';
import { DiaryHistoryList } from './DiaryHistoryList';
import type { DiaryEntryWithTriggers } from '../types';
import type { ThemeColors } from '../../../theme/types';
import { RatingIndicator, RATING_LABELS } from './RatingIndicator';

interface DiaryCalendarViewProps {
  entries: DiaryEntryWithTriggers[];
  onDeleteEntry: (entryId: number) => void;
  hiddenId: number | null;
}

const WEEKDAY_LABELS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

/**
 * Hoehe einer Kalenderzelle. Vorher quadratisch (aspectRatio 1), also so hoch
 * wie ein Siebtel der Bildschirmbreite -- auf einem 393dp breiten Geraet rund
 * 49dp. Sechs Reihen kosteten damit fast 300dp, waehrend Zahl und
 * Bewertungspunkt zusammen nur etwa 27dp brauchen. Die untere Haelfte jeder
 * Zelle blieb leer und der ausgewaehlte Tag darunter wurde abgeschnitten.
 * 44dp bleibt oberhalb der ueblichen Mindestgroesse fuer Tippziele.
 */
const CELL_HEIGHT = 44;

function formatMonthTitle(year: number, month: number): string {
  return new Date(year, month, 1).toLocaleDateString('de-DE', { month: 'long', year: 'numeric' });
}

export function DiaryCalendarView({ entries, onDeleteEntry, hiddenId }: DiaryCalendarViewProps) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const today = new Date();
  const [visibleMonth, setVisibleMonth] = useState({ year: today.getFullYear(), month: today.getMonth() });
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const entriesByDay = groupEntriesByDay(entries);
  const cells = buildCalendarGrid(visibleMonth.year, visibleMonth.month);
  const selectedEntries = selectedDate ? entriesByDay.get(selectedDate) ?? [] : [];

  function handlePrevMonth() {
    setSelectedDate(null);
    setVisibleMonth((current) => {
      const previous = new Date(current.year, current.month - 1, 1);
      return { year: previous.getFullYear(), month: previous.getMonth() };
    });
  }

  function handleNextMonth() {
    setSelectedDate(null);
    setVisibleMonth((current) => {
      const next = new Date(current.year, current.month + 1, 1);
      return { year: next.getFullYear(), month: next.getMonth() };
    });
  }

  function handleSelectDay(date: string) {
    setSelectedDate((current) => (current === date ? null : date));
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Vorheriger Monat"
          onPress={handlePrevMonth}
          style={styles.navButton}
        >
          <Text style={styles.navButtonText}>◀</Text>
        </Pressable>
        <Text style={styles.monthTitle}>{formatMonthTitle(visibleMonth.year, visibleMonth.month)}</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Nächster Monat"
          onPress={handleNextMonth}
          style={styles.navButton}
        >
          <Text style={styles.navButtonText}>▶</Text>
        </Pressable>
      </View>

      <View style={styles.weekdayRow}>
        {WEEKDAY_LABELS.map((label) => (
          <Text key={label} style={styles.weekdayLabel}>
            {label}
          </Text>
        ))}
      </View>

      <View style={styles.grid}>
        {cells.map((cell) => {
          const dayEntries = entriesByDay.get(cell.date) ?? [];
          const hasEntries = dayEntries.length > 0;
          const rating = hasEntries ? rateDayEntries(dayEntries) : null;
          const isSelected = selectedDate === cell.date;

          return (
            <Pressable
              key={cell.date}
              accessibilityRole="button"
              accessibilityLabel={`Tag ${cell.dayOfMonth}${rating ? `, Bewertung: ${RATING_LABELS[rating]}` : ''}`}
              disabled={!hasEntries}
              onPress={() => handleSelectDay(cell.date)}
              style={[styles.cell, !cell.isCurrentMonth && styles.cellOutsideMonth, isSelected && styles.cellSelected]}
            >
              <Text style={[styles.cellText, !cell.isCurrentMonth && styles.cellTextOutsideMonth]}>
                {cell.dayOfMonth}
              </Text>
              {rating && <RatingIndicator rating={rating} />}
            </Pressable>
          );
        })}
      </View>

      <View style={styles.legend}>
        <Text style={styles.legendText}>
          <Text style={{ color: colors.success }}>●</Text> Gut · <Text style={{ color: colors.warning }}>■</Text>{' '}
          Mittel · <Text style={{ color: colors.danger }}>▲</Text> Schub-verdächtig
        </Text>
      </View>

      {selectedDate && selectedEntries.length > 0 && (
        <View style={styles.selectedDayList}>
          {/* selectedEntries is always non-empty here, so DiaryHistoryList's empty state
              (and therefore onCreate) never renders in this context. */}
          <DiaryHistoryList
            entries={selectedEntries}
            onDelete={onDeleteEntry}
            onCreate={() => {}}
            hiddenId={hiddenId}
          />
        </View>
      )}
    </View>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      flex: 1,
      paddingHorizontal: tokens.spacing.lg,
      paddingTop: tokens.spacing.md,
      // Unten kein Abstand: Die Liste des ausgewaehlten Tages bringt ihren
      // eigenen mit, und jeder Punkt hier fehlt ihr.
      paddingBottom: 0,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: tokens.spacing.sm,
    },
    navButton: {
      paddingVertical: tokens.spacing.xs,
      paddingHorizontal: tokens.spacing.md,
    },
    navButtonText: {
      color: colors.primary,
      fontSize: tokens.typography.fontSize.lg,
      fontWeight: tokens.typography.fontWeight.bold,
    },
    monthTitle: {
      color: colors.textPrimary,
      fontSize: tokens.typography.fontSize.lg,
      fontWeight: tokens.typography.fontWeight.medium,
    },
    weekdayRow: {
      flexDirection: 'row',
    },
    weekdayLabel: {
      flexBasis: '14.28%',
      textAlign: 'center',
      color: colors.textSecondary,
      fontSize: tokens.typography.fontSize.sm,
      fontWeight: tokens.typography.fontWeight.medium,
      marginBottom: tokens.spacing.xs,
    },
    grid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
    },
    cell: {
      flexBasis: '14.28%',
      height: CELL_HEIGHT,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: tokens.radius.sm,
    },
    cellOutsideMonth: {
      opacity: 0.35,
    },
    cellSelected: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.primary,
    },
    cellText: {
      color: colors.textPrimary,
      fontSize: tokens.typography.fontSize.sm,
    },
    cellTextOutsideMonth: {
      color: colors.textSecondary,
    },
    legend: {
      marginTop: tokens.spacing.xs,
      alignItems: 'center',
    },
    legendText: {
      color: colors.textSecondary,
      fontSize: tokens.typography.fontSize.sm,
    },
    selectedDayList: {
      // Kein eigener Abstand nach oben: Die Liste setzt selbst einen Rand von
      // tokens.spacing.lg, und der Platz wird hier unten gebraucht.
      flex: 1,
    },
  });
}
