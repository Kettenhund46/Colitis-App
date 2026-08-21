import { Pressable, Text, View, StyleSheet } from 'react-native';
import { useTheme } from '../../theme/ThemeContext';
import { tokens } from '../../styles/tokens';
import type { ThemeColors } from '../../theme/types';

interface UndoBarProps {
  /** Was geloescht wurde, etwa "Eintrag" oder "Medikament". */
  label: string;
  onUndo: () => void;
}

export function UndoBar({ label, onUndo }: UndoBarProps) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);

  return (
    <View style={styles.bar} accessibilityRole="alert">
      <Text style={styles.text}>{label} gelöscht</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label} wiederherstellen`}
        style={styles.button}
        onPress={onUndo}
      >
        <Text style={styles.buttonText}>Rückgängig</Text>
      </Pressable>
    </View>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    bar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: colors.textPrimary,
      borderRadius: tokens.radius.md,
      margin: tokens.spacing.md,
      paddingVertical: tokens.spacing.sm,
      paddingHorizontal: tokens.spacing.md,
    },
    text: {
      color: colors.surface,
      fontSize: tokens.typography.fontSize.sm,
      flexShrink: 1,
    },
    button: {
      paddingVertical: tokens.spacing.xs,
      paddingHorizontal: tokens.spacing.sm,
    },
    buttonText: {
      color: colors.accent,
      fontSize: tokens.typography.fontSize.sm,
      fontWeight: tokens.typography.fontWeight.bold,
    },
  });
}
