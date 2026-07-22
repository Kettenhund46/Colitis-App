import { Pressable, Text, View, StyleSheet } from 'react-native';
import { useTheme } from '../../../theme/ThemeContext';
import { tokens } from '../../../styles/tokens';
import type { ThemeColors } from '../../../theme/types';

interface FlareWarningBannerProps {
  onDismiss: () => void;
}

export function FlareWarningBanner({ onDismiss }: FlareWarningBannerProps) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  return (
    <View style={styles.banner}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Warnung schließen"
        style={styles.closeButton}
        onPress={onDismiss}
      >
        <Text style={styles.closeButtonText}>×</Text>
      </Pressable>
      <Text style={styles.text}>
        Mehrere schub-verdächtige Tage in der letzten Woche – ziehe in Erwägung, deinen Arzt zu kontaktieren.
      </Text>
    </View>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    banner: {
      backgroundColor: colors.surface,
      borderBottomWidth: 2,
      borderBottomColor: colors.danger,
      padding: tokens.spacing.md,
      paddingRight: tokens.spacing.xl,
    },
    closeButton: {
      position: 'absolute',
      right: tokens.spacing.sm,
      top: tokens.spacing.sm,
      width: 28,
      height: 28,
      alignItems: 'center',
      justifyContent: 'center',
    },
    closeButtonText: {
      fontSize: tokens.typography.fontSize.lg,
      color: colors.textSecondary,
    },
    text: {
      color: colors.textPrimary,
      fontSize: tokens.typography.fontSize.sm,
    },
  });
}
