import { Linking, Pressable, Text, View, StyleSheet } from 'react-native';
import { useTheme } from '../../../theme/ThemeContext';
import { tokens } from '../../../styles/tokens';
import type { ThemeColors } from '../../../theme/types';

export function LocationPermissionBanner() {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  return (
    <View style={styles.banner}>
      <Text style={styles.text}>
        Standortberechtigung erforderlich, um Toiletten in deiner Nähe zu finden.
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Geräteeinstellungen öffnen"
        style={styles.settingsButton}
        onPress={() => Linking.openSettings()}
      >
        <Text style={styles.settingsButtonText}>Einstellungen öffnen</Text>
      </Pressable>
    </View>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    banner: {
      backgroundColor: colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      padding: tokens.spacing.sm,
      alignItems: 'center',
    },
    text: {
      color: colors.textSecondary,
      fontSize: tokens.typography.fontSize.sm,
      textAlign: 'center',
      marginBottom: tokens.spacing.xs,
    },
    settingsButton: {
      paddingVertical: tokens.spacing.xs,
      paddingHorizontal: tokens.spacing.md,
      borderRadius: 8,
      backgroundColor: colors.primary,
    },
    settingsButtonText: {
      color: colors.surface,
      fontSize: tokens.typography.fontSize.sm,
    },
  });
}
