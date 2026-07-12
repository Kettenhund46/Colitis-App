import { Stack } from 'expo-router';
import { tokens } from '../../../src/styles/tokens';

export default function MedikamenteLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: tokens.colors.background },
        headerTintColor: tokens.colors.textPrimary,
        headerShadowVisible: false,
      }}
    >
      <Stack.Screen name="index" options={{ title: 'Medikamente' }} />
      <Stack.Screen name="neu" options={{ title: 'Neues Medikament' }} />
      <Stack.Screen name="[id]" options={{ title: 'Medikament bearbeiten' }} />
    </Stack>
  );
}
