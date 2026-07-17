import { Link, Stack } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { tokens } from '../src/styles/tokens';
import { useTheme } from '../src/theme/ThemeContext';
import type { ThemeColors } from '../src/theme/types';

export default function NotFoundScreen() {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
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

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: tokens.spacing.lg,
      backgroundColor: colors.background,
    },
    title: {
      fontSize: tokens.typography.fontSize.lg,
      fontWeight: tokens.typography.fontWeight.bold,
      color: colors.textPrimary,
    },
    link: {
      marginTop: tokens.spacing.md,
      paddingVertical: tokens.spacing.md,
    },
    linkText: {
      fontSize: tokens.typography.fontSize.sm,
      color: colors.accent,
    },
  });
}
