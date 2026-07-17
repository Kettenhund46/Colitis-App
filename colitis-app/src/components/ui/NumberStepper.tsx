import { Pressable, Text, View, StyleSheet } from 'react-native';
import { useTheme } from '../../theme/ThemeContext';
import { tokens } from '../../styles/tokens';
import type { ThemeColors } from '../../theme/types';

interface NumberStepperProps {
  label: string;
  value: number;
  onChange: (next: number) => void;
  min?: number;
  max?: number;
}

export function NumberStepper({ label, value, onChange, min = 0, max = 20 }: NumberStepperProps) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const canDecrement = value > min;
  const canIncrement = value < max;

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.row}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${label} verringern`}
          disabled={!canDecrement}
          onPress={() => onChange(value - 1)}
          style={[styles.button, !canDecrement && styles.buttonDisabled]}
        >
          <Text style={styles.buttonText}>−</Text>
        </Pressable>
        <Text style={styles.value}>{value}</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${label} erhöhen`}
          disabled={!canIncrement}
          onPress={() => onChange(value + 1)}
          style={[styles.button, !canIncrement && styles.buttonDisabled]}
        >
          <Text style={styles.buttonText}>+</Text>
        </Pressable>
      </View>
    </View>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      marginBottom: tokens.spacing.md,
    },
    label: {
      color: colors.textPrimary,
      fontSize: tokens.typography.fontSize.md,
      marginBottom: tokens.spacing.xs,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    button: {
      width: 40,
      height: 40,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    buttonDisabled: {
      backgroundColor: colors.border,
    },
    buttonText: {
      fontSize: tokens.typography.fontSize.lg,
      color: colors.textPrimary,
    },
    value: {
      minWidth: 40,
      textAlign: 'center',
      fontSize: tokens.typography.fontSize.lg,
      color: colors.textPrimary,
      marginHorizontal: tokens.spacing.sm,
    },
  });
}
