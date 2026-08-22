import { Stack } from 'expo-router';
import { useTheme } from '../../../src/theme/ThemeContext';

export default function MedikamenteLayout() {
  const { colors } = useTheme();

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.textPrimary,
        headerShadowVisible: false,
      }}
    >
      <Stack.Screen name="index" options={{ title: 'Medikamente' }} />
      <Stack.Screen name="neu" options={{ title: 'Neues Medikament' }} />
      <Stack.Screen name="verlauf" options={{ title: 'Einnahme-Verlauf' }} />
      <Stack.Screen name="[id]" options={{ title: 'Medikament bearbeiten' }} />
    </Stack>
  );
}
