import { useRouter } from 'expo-router';
import { View, StyleSheet } from 'react-native';
import { OnboardingView } from '../src/features/onboarding/components/OnboardingView';
import { useTheme } from '../src/theme/ThemeContext';
import type { ThemeColors } from '../src/theme/types';

/**
 * Die Einfuehrung zum spaeteren Nachlesen, aufgerufen aus den Einstellungen.
 * Beim ersten Start zeigt das Startlayout dieselbe Ansicht ohne Route --
 * dort gibt es noch nichts, wohin ein "Zurueck" fuehren koennte.
 */
export default function WillkommenScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = makeStyles(colors);

  return (
    <View style={styles.container}>
      <OnboardingView onDone={() => router.back()} skipLabel="Schließen" />
    </View>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
  });
}
