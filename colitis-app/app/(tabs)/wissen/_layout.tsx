import { Stack } from 'expo-router';
import { useTheme } from '../../../src/theme/ThemeContext';

export default function WissenLayout() {
  const { colors } = useTheme();

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.textPrimary,
        headerShadowVisible: false,
      }}
    >
      <Stack.Screen name="index" options={{ title: 'Wissen' }} />
      <Stack.Screen name="[slug]" options={{ title: 'Artikel' }} />
      <Stack.Screen name="feed" options={{ title: 'Neuigkeiten' }} />
    </Stack>
  );
}
