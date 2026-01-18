// lib/socket.ts - Create this file
import { Platform } from 'react-native';

// For Android physical device on same WiFi
const ANDROID_URL = 'http://10.98.28.101:5000'; // Your laptop IP

// For Android emulator
const EMULATOR_URL = 'http://10.0.2.2:5000';

// For iOS
const IOS_URL = 'http://localhost:5000';

// Simple - Use your IP always
export const SOCKET_URL = 'https://gps-tracking-system-for-ambulance-1.onrender.com';

// Or detect platform
export const getSocketUrl = () => {
  if (Platform.OS === 'android') {
    // Check if running on device or emulator
    return 'http://10.98.28.101:5000'; // Your IP
  }
  return 'http://localhost:5000'; // iOS
};