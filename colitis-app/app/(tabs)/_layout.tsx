import { Tabs } from 'expo-router';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { tokens } from '../../src/styles/tokens';

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: tokens.colors.primary,
        tabBarInactiveTintColor: tokens.colors.textSecondary,
      }}
    >
      <Tabs.Screen name="index" options={{ href: null }} />
      <Tabs.Screen
        name="tagebuch/index"
        options={{
          title: 'Tagebuch',
          tabBarIcon: ({ color, size }) => <MaterialCommunityIcons name="notebook-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="wissen/index"
        options={{
          title: 'Wissen',
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="book-open-page-variant-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="medikamente/index"
        options={{
          title: 'Medikamente',
          tabBarIcon: ({ color, size }) => <MaterialCommunityIcons name="pill" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="toiletten/index"
        options={{
          title: 'Toiletten',
          tabBarIcon: ({ color, size }) => <MaterialCommunityIcons name="toilet" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="einstellungen/index"
        options={{
          title: 'Einstellungen',
          tabBarIcon: ({ color, size }) => <MaterialCommunityIcons name="cog-outline" size={size} color={color} />,
        }}
      />
    </Tabs>
  );
}
