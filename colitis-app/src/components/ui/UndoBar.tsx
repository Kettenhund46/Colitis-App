import { Pressable, Text, View, StyleSheet } from 'react-native';
import { useTheme } from '../../theme/ThemeContext';
import { tokens } from '../../styles/tokens';
import { FAB_CLEARANCE } from './floatingActionButton';
import type { ThemeColors } from '../../theme/types';

interface UndoBarProps {
  /** Was geloescht wurde, etwa "Eintrag" oder "Medikament". */
  label: string;
  onUndo: () => void;
  /**
   * Ob der Streifen dem "+"-Knopf ausweichen muss. Bildschirme ohne diesen
   * Knopf setzen false; sonst bleibt unter dem Streifen eine leere Flaeche.
   */
  avoidsFloatingButton?: boolean;
}

export function UndoBar({ label, onUndo, avoidsFloatingButton = true }: UndoBarProps) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);

  return (
    <View
      style={[styles.bar, !avoidsFloatingButton && styles.barWithoutFloatingButton]}
      accessibilityRole="alert"
      // Ohne liveRegion sagt TalkBack den Streifen nicht an. Er ist nach acht
      // Sekunden weg -- wer ihn nicht sieht, erfuehre sonst nie, dass es ihn
      // gab. "assertive" statt "polite", weil die Frist laeuft.
      accessibilityLiveRegion="assertive"
    >
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
    barWithoutFloatingButton: {
      marginBottom: tokens.spacing.md,
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
