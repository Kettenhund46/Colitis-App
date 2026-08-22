import { Pressable, Text, View, StyleSheet } from 'react-native';
import { useTheme } from '../../theme/ThemeContext';
import { tokens } from '../../styles/tokens';
import type { ThemeColors } from '../../theme/types';

/** Kantenlaenge des "+"-Knopfes, wie ihn Tagebuch, Medikamente und Arztbesuche setzen. */
const FAB_SIZE = 56;

/**
 * Wie weit der Streifen ueber dem unteren Bildschirmrand bleiben muss, damit
 * der "+"-Knopf nicht den Rueckgaengig-Knopf verdeckt. Der Knopf sitzt absolut
 * bei bottom: tokens.spacing.lg und ist FAB_SIZE hoch; darueber noch ein
 * kleiner Abstand. Aus den Werten abgeleitet und nicht ausgeschrieben, damit
 * eine spaetere Aenderung am Knopf hier nicht still danebenlaeuft.
 */
const FAB_CLEARANCE = tokens.spacing.lg + FAB_SIZE + tokens.spacing.sm;

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
      marginHorizontal: tokens.spacing.md,
      marginTop: tokens.spacing.md,
      // Haelt den Streifen ueber dem "+"-Knopf, der bei drei Bildschirmen
      // absolut bei bottom: 24 mit 56 Pixeln Hoehe sitzt und sonst genau den
      // Rueckgaengig-Knopf verdeckt.
      marginBottom: FAB_CLEARANCE,
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
