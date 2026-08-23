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
      <Stack.Screen name="schnell" options={{ title: 'Schnell-Eintrag' }} />
      <Stack.Screen name="auswertung" options={{ title: 'Auswertung' }} />
      <Stack.Screen name="arztbesuche/index" options={{ title: 'Arztbesuche' }} />
      <Stack.Screen name="arztbesuche/neu" options={{ title: 'Neuer Arztbesuch' }} />
      <Stack.Screen name="arztbesuche/[id]" options={{ title: 'Arztbesuch bearbeiten' }} />
      <Stack.Screen name="arztbesuche/zusammenfassung" options={{ title: 'Zusammenfassung' }} />
    </Stack>
  );
}
