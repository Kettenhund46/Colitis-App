import { useEffect, useState } from 'react';
import { Modal, Pressable, Text, View, StyleSheet } from 'react-native';
import { useTheme } from '../../../theme/ThemeContext';
import { getDailyJokeEnabled, getIncludeIllnessJokes } from '../../settings/settingsStorage';
import { buildJokePool } from '../buildJokePool';
import { pickJokeForDate } from '../pickJokeForDate';
import { tokens } from '../../../styles/tokens';
import type { ThemeColors } from '../../../theme/types';

export function DailyJokeModal() {
  const { colors } = useTheme();
  const [joke, setJoke] = useState<string | null>(null);
  const styles = makeStyles(colors);

  useEffect(() => {
    let isActive = true;
    getDailyJokeEnabled()
      .then(async (enabled) => {
        if (!enabled || !isActive) {
          return;
        }
        const includeIllnessJokes = await getIncludeIllnessJokes();
        const pool = buildJokePool(includeIllnessJokes);
        if (isActive) {
          setJoke(pickJokeForDate(new Date(), pool));
        }
      })
      .catch((error: unknown) => {
        console.error('[DailyJoke] Wortwitz konnte nicht geladen werden:', error);
      });
    return () => {
      isActive = false;
    };
  }, []);

  if (!joke) {
    return null;
  }

  return (
    <Modal transparent animationType="fade" visible onRequestClose={() => setJoke(null)}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Text style={styles.title}>Wortwitz des Tages</Text>
          <Text style={styles.joke}>{joke}</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Schließen"
            style={styles.closeButton}
            onPress={() => setJoke(null)}
          >
            <Text style={styles.closeButtonText}>Schließen</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    overlay: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: tokens.spacing.lg,
      backgroundColor: colors.overlay,
    },
    card: {
      borderRadius: tokens.radius.md,
      padding: tokens.spacing.lg,
      width: '100%',
      maxWidth: 360,
      backgroundColor: colors.surface,
    },
    title: {
      fontSize: tokens.typography.fontSize.lg,
      fontWeight: tokens.typography.fontWeight.bold,
      marginBottom: tokens.spacing.md,
      textAlign: 'center',
      color: colors.textPrimary,
    },
    joke: {
      fontSize: tokens.typography.fontSize.md,
      textAlign: 'center',
      marginBottom: tokens.spacing.lg,
      color: colors.textPrimary,
    },
    closeButton: {
      borderRadius: 8,
      paddingVertical: tokens.spacing.md,
      alignItems: 'center',
      backgroundColor: colors.primary,
    },
    closeButtonText: {
      fontSize: tokens.typography.fontSize.md,
      fontWeight: tokens.typography.fontWeight.bold,
      color: colors.surface,
    },
  });
}
