// lib/socket.ts
import { Platform } from 'react-native';

// Your Render URL
export const SOCKET_URL = 'https://gps-tracking-system-for-ambulance-1.onrender.com';

// For local development vs production
export const getSocketUrl = () => {
  // You can keep this for development
  if (__DEV__) {
    // Development - use local IP
    if (Platform.OS === 'android') {
      return 'http://10.98.28.101:5000'; // Your local IP
    }
    return 'http://localhost:5000'; // iOS
  }
  // Production - use Render URL
  return SOCKET_URL;
};