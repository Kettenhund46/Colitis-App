import { Text, View, StyleSheet } from 'react-native';
import { useTheme } from '../../../theme/ThemeContext';
import { tokens } from '../../../styles/tokens';
import { TRIGGER_CATEGORY_OPTIONS } from '../constants';
import { Card } from '../../../components/ui/Card';
import { EmptyState } from '../../../components/ui/EmptyState';
import type { TriggerPatternStat } from '../analysis';
import type { ThemeColors } from '../../../theme/types';

interface TriggerAnalysisViewProps {
  patterns: TriggerPatternStat[];
}

function labelForCategory(category: string): string {
  return TRIGGER_CATEGORY_OPTIONS.find((option) => option.key === category)?.label ?? category;
}

export function TriggerAnalysisView({ patterns }: TriggerAnalysisViewProps) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);

  if (patterns.length === 0) {
    return (
      <EmptyState
        title="Noch keine Muster erkennbar"
        description="Sobald du beim Eintragen Auslöser mit erfasst, erscheint hier, welche davon mit stärkeren Beschwerden zusammenfallen."
      />
    );
  }

  return (
    <View style={styles.list}>
      {patterns.map((pattern) => (
        <Card key={pattern.category}>
          <Text style={styles.cardTitle}>{labelForCategory(pattern.category)}</Text>
          <Text style={styles.cardDetail}>
            {pattern.entryCount} {pattern.entryCount === 1 ? 'Eintrag' : 'Einträge'}
          </Text>
          <Text style={styles.cardDetail}>Ø Schmerzlevel: {pattern.averagePainLevel}/10</Text>
        </Card>
      ))}
    </View>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    list: {
      padding: tokens.spacing.lg,
      gap: tokens.spacing.md,
    },
    cardTitle: {
      color: colors.textPrimary,
      fontSize: tokens.typography.fontSize.md,
      fontWeight: tokens.typography.fontWeight.bold,
      marginBottom: tokens.spacing.xs,
    },
    cardDetail: {
      color: colors.textSecondary,
      fontSize: tokens.typography.fontSize.sm,
    },
  });
}
