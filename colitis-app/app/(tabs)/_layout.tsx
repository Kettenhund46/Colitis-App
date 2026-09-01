import { Tabs } from 'expo-router';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useTheme } from '../../src/theme/ThemeContext';

export default function TabsLayout() {
  const { colors } = useTheme();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textSecondary,
      }}
    >
      <Tabs.Screen name="index" options={{ href: null }} />
      <Tabs.Screen
        name="tagebuch"
        options={{
          title: 'Tagebuch',
          popToTopOnBlur: true,
          tabBarIcon: ({ color, size }) => <MaterialCommunityIcons name="notebook-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="wissen"
        options={{
          title: 'Wissen',
          popToTopOnBlur: true,
          tabBarIcon: ({ color, size }) => <MaterialCommunityIcons name="book-open-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="medikamente"
        options={{
          title: 'Medikamente',
          popToTopOnBlur: true,
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
