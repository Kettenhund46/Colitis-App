import { Linking, Pressable, Text, View, StyleSheet } from 'react-native';
import { tokens } from '../../../styles/tokens';

export function LocationPermissionBanner() {
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

const styles = StyleSheet.create({
  banner: {
    backgroundColor: tokens.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: tokens.colors.border,
    padding: tokens.spacing.sm,
    alignItems: 'center',
  },
  text: {
    color: tokens.colors.textSecondary,
    fontSize: tokens.typography.fontSize.sm,
    textAlign: 'center',
    marginBottom: tokens.spacing.xs,
  },
  settingsButton: {
    paddingVertical: tokens.spacing.xs,
    paddingHorizontal: tokens.spacing.md,
    borderRadius: 8,
    backgroundColor: tokens.colors.primary,
  },
  settingsButtonText: {
    color: tokens.colors.surface,
    fontSize: tokens.typography.fontSize.sm,
  },
});
