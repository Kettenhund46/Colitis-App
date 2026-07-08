import { Stack } from 'expo-router';
import { tokens } from '../../../src/styles/tokens';

export default function TagebuchLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: tokens.colors.background },
        headerTintColor: tokens.colors.textPrimary,
        headerShadowVisible: false,
      }}
    >
      <Stack.Screen name="index" options={{ title: 'Tagebuch' }} />
      <Stack.Screen name="neu" options={{ title: 'Neuer Eintrag' }} />
    </Stack>
  );
}
