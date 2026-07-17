import { Stack } from 'expo-router';
import { useTheme } from '../../../src/theme/ThemeContext';

export default function TagebuchLayout() {
  const { colors } = useTheme();

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.textPrimary,
        headerShadowVisible: false,
      }}
    >
      <Stack.Screen name="index" options={{ title: 'Tagebuch' }} />
      <Stack.Screen name="neu" options={{ title: 'Neuer Eintrag' }} />
      <Stack.Screen name="auswertung" options={{ title: 'Auswertung' }} />
    </Stack>
  );
}
