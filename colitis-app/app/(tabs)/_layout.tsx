import { Tabs } from 'expo-router';

export default function TabsLayout() {
  return (
    <Tabs screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="tagebuch/index" options={{ title: 'Tagebuch' }} />
      <Tabs.Screen name="wissen/index" options={{ title: 'Wissen' }} />
      <Tabs.Screen name="medikamente/index" options={{ title: 'Medikamente' }} />
      <Tabs.Screen name="toiletten/index" options={{ title: 'Toiletten' }} />
      <Tabs.Screen name="einstellungen/index" options={{ title: 'Einstellungen' }} />
    </Tabs>
  );
}
