import { View, StyleSheet } from 'react-native';
import { useTheme } from '../../theme/ThemeContext';
import { surfaceTreatmentFor, accentColorFor, cardSurfaceStyle, ACCENT_BORDER_WIDTH } from './cardStyle';
import type { ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import type { CardAccent } from './cardStyle';

export type { CardAccent } from './cardStyle';

const MUTED_OPACITY = 0.6;

interface CardProps {
  children: ReactNode;
  /** Bedeutung der Zustandskante. Ohne diesen Wert hat die Karte keine Kante. */
  accent?: CardAccent;
  /** Gedaempfter Inhalt, etwa ein beendetes Medikament. Unabhaengig von accent. */
  isMuted?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function Card({ children, accent, isMuted = false, style }: CardProps) {
  const { colors, themeId } = useTheme();
  const surface = cardSurfaceStyle(colors, surfaceTreatmentFor(themeId));
  const accentColor = accentColorFor(accent, colors);

  return (
    <View
      style={[
        surface,
        accentColor !== null && { borderLeftWidth: ACCENT_BORDER_WIDTH, borderLeftColor: accentColor },
        isMuted && styles.muted,
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  muted: {
    opacity: MUTED_OPACITY,
  },
});
