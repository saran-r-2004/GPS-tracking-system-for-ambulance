import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';

export default function RootLayout() {
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    // You can add authentication logic here if needed
    // For now, just set up basic routing
    console.log('App loaded, segments:', segments);
  }, []);

  return (
    <>
      <StatusBar style="auto" />
      <Stack
        screenOptions={{
          headerStyle: {
            backgroundColor: '#D32F2F',
          },
          headerTintColor: '#FFF',
          headerTitleStyle: {
            fontWeight: 'bold',
          },
        }}
      >
        <Stack.Screen 
          name="index" 
          options={{ headerShown: false }} 
        />
        <Stack.Screen 
          name="login" 
          options={{ headerShown: false }} 
        />
        <Stack.Screen 
          name="(tabs)" 
          options={{ headerShown: false }} 
        />
        <Stack.Screen 
          name="driver/login" 
          options={{ title: "Driver Login" }} 
        />
        <Stack.Screen 
          name="driver/dashboard" 
          options={{ title: "Driver Dashboard" }} 
        />
        <Stack.Screen 
          name="hospital-admin/login" 
          options={{ title: "Hospital Admin Login" }} 
        />
        <Stack.Screen 
          name="hospital-admin/dashboard" 
          options={{ title: "Hospital Dashboard" }} 
        />
      </Stack>
    </>
  );
}