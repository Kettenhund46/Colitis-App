import { Pressable, Text, View, StyleSheet } from 'react-native';
import { GhostCard } from './GhostCard';
import { useTheme } from '../../theme/ThemeContext';
import { tokens } from '../../styles/tokens';
import type { ThemeColors } from '../../theme/types';

interface EmptyStateProps {
  title: string;
  description: string;
  action?: { label: string; onPress: () => void };
  /**
   * Geisterkarte zeigen. false bei ergebnisloser Abfrage: Dort entsteht nichts
   * durch Anlegen, eine Formvorschau waere ein falsches Versprechen.
   */
  showGhost?: boolean;
}

export function EmptyState({ title, description, action, showGhost = true }: EmptyStateProps) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);

  return (
    <View style={styles.container}>
      {showGhost && (
        <View style={styles.ghostWrapper}>
          <GhostCard lines={2} />
        </View>
      )}
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.description}>{description}</Text>
      {action && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={action.label}
          style={styles.button}
          onPress={action.onPress}
        >
          <Text style={styles.buttonText}>{action.label}</Text>
        </Pressable>
      )}
    </View>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: tokens.spacing.lg,
      backgroundColor: colors.background,
    },
    ghostWrapper: {
      alignSelf: 'stretch',
      maxWidth: 320,
      width: '100%',
      marginBottom: tokens.spacing.sm,
    },
    title: {
      color: colors.textPrimary,
      fontSize: tokens.typography.fontSize.md,
      fontWeight: tokens.typography.fontWeight.bold,
      textAlign: 'center',
      marginBottom: tokens.spacing.xs,
    },
    description: {
      color: colors.textSecondary,
      fontSize: tokens.typography.fontSize.sm,
      textAlign: 'center',
      lineHeight: 20,
      maxWidth: 300,
    },
    button: {
      marginTop: tokens.spacing.md,
      backgroundColor: colors.primary,
      borderRadius: tokens.radius.pill,
      paddingVertical: tokens.spacing.sm,
      paddingHorizontal: tokens.spacing.lg,
    },
    buttonText: {
      color: colors.surface,
      fontSize: tokens.typography.fontSize.sm,
      fontWeight: tokens.typography.fontWeight.medium,
    },
  });
}
