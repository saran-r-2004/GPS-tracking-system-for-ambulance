import { Tabs } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#D32F2F',
        tabBarInactiveTintColor: 'gray',
        headerStyle: {
          backgroundColor: '#D32F2F',
        },
        headerTintColor: '#FFF',
        headerTitleStyle: {
          fontWeight: 'bold',
        },
      }}
    >
      {/* Remove Emergency tab completely, only keep Track */}
      <Tabs.Screen
        name="track"
        options={{
          title: 'Track Ambulance',
          tabBarIcon: ({ color, size }) => (
            <MaterialIcons name="location-on" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}