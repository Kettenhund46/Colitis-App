import { Stack } from 'expo-router';
import { tokens } from '../../../src/styles/tokens';

export default function WissenLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: tokens.colors.background },
        headerTintColor: tokens.colors.textPrimary,
        headerShadowVisible: false,
      }}
    >
      <Stack.Screen name="index" options={{ title: 'Wissen' }} />
      <Stack.Screen name="[slug]" options={{ title: 'Artikel' }} />
      <Stack.Screen name="feed" options={{ title: 'Neuigkeiten' }} />
    </Stack>
  );
}
