import { Link, Stack } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { tokens } from '../src/styles/tokens';

export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ title: 'Nicht gefunden' }} />
      <View style={styles.container}>
        <Text style={styles.title}>Diese Seite existiert nicht.</Text>

        <Link href="/" style={styles.link}>
          <Text style={styles.linkText}>Zur Startseite</Text>
        </Link>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: tokens.spacing.lg,
    backgroundColor: tokens.colors.background,
  },
  title: {
    fontSize: tokens.typography.fontSize.lg,
    fontWeight: tokens.typography.fontWeight.bold,
    color: tokens.colors.textPrimary,
  },
  link: {
    marginTop: tokens.spacing.md,
    paddingVertical: tokens.spacing.md,
  },
  linkText: {
    fontSize: tokens.typography.fontSize.sm,
    color: tokens.colors.accent,
  },
});
